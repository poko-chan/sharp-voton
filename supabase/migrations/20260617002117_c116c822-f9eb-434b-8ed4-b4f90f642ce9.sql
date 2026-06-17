
-- ============ 1. Makron 問題作成権限を管理者のみに制限 ============
DROP POLICY IF EXISTS "questions create by anyone" ON public.makron_questions;
DROP POLICY IF EXISTS "creators write questions" ON public.makron_questions;
DROP POLICY IF EXISTS "creators edit own pending q" ON public.makron_questions;
DROP POLICY IF EXISTS "creators delete own pending q" ON public.makron_questions;

-- ============ 2. 組織作成を管理者のみに制限 ============
DROP POLICY IF EXISTS "anyone can apply" ON public.organizations;
DROP POLICY IF EXISTS "users can create org" ON public.organizations;
DROP POLICY IF EXISTS "auth can request org" ON public.organizations;
CREATE POLICY "admins create orgs" ON public.organizations
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ 3. organization_invitations テーブル ============
CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invitee_id uuid NOT NULL,
  invited_by uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  message text,
  status text NOT NULL DEFAULT 'pending', -- pending | accepted | rejected | cancelled
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  UNIQUE(organization_id, invitee_id, status)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_invitations TO authenticated;
GRANT ALL ON public.organization_invitations TO service_role;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invitee or org admin can read" ON public.organization_invitations
  FOR SELECT TO authenticated USING (
    invitee_id = auth.uid()
    OR public.is_org_admin(organization_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "org admin can invite" ON public.organization_invitations
  FOR INSERT TO authenticated WITH CHECK (
    public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "invitee or admin can update" ON public.organization_invitations
  FOR UPDATE TO authenticated USING (
    invitee_id = auth.uid()
    OR public.is_org_admin(organization_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE OR REPLACE FUNCTION public.org_invite_member(_org uuid, _user uuid, _role text DEFAULT 'member', _message text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT (public.is_org_admin(_org, auth.uid()) OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF EXISTS(SELECT 1 FROM public.organization_members WHERE organization_id=_org AND user_id=_user) THEN
    RAISE EXCEPTION 'すでにメンバーです';
  END IF;
  INSERT INTO public.organization_invitations(organization_id, invitee_id, invited_by, role, message)
  VALUES (_org, _user, auth.uid(), _role, _message)
  ON CONFLICT (organization_id, invitee_id, status) DO UPDATE
    SET message=EXCLUDED.message, role=EXCLUDED.role, invited_by=auth.uid(), created_at=now()
  RETURNING id INTO v_id;
  INSERT INTO public.notifications(user_id, type, title, body, meta)
    SELECT _user, 'org_invite', '組織への招待が届きました', o.name, jsonb_build_object('org_id', _org, 'invite_id', v_id)
    FROM public.organizations o WHERE o.id=_org;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.org_respond_invitation(_invite_id uuid, _accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.organization_invitations;
BEGIN
  SELECT * INTO v FROM public.organization_invitations WHERE id=_invite_id;
  IF v.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF v.invitee_id <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v.status <> 'pending' THEN RAISE EXCEPTION 'already responded'; END IF;
  UPDATE public.organization_invitations
    SET status = CASE WHEN _accept THEN 'accepted' ELSE 'rejected' END, responded_at=now()
    WHERE id=_invite_id;
  IF _accept THEN
    INSERT INTO public.organization_members(organization_id, user_id, role)
      VALUES (v.organization_id, v.invitee_id, v.role)
      ON CONFLICT (organization_id, user_id) DO UPDATE SET role=EXCLUDED.role, suspended=false;
  END IF;
END $$;

-- ============ 4. ショップ管理者編集 + カスタム商品 ============
ALTER TABLE public.coin_shop_items
  ADD COLUMN IF NOT EXISTS auto_grant boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "admins manage shop items" ON public.coin_shop_items;
CREATE POLICY "admins manage shop items" ON public.coin_shop_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 引き換えリクエスト
CREATE TABLE IF NOT EXISTS public.coin_redemption_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_id uuid NOT NULL REFERENCES public.coin_shop_items(id) ON DELETE SET NULL,
  item_code text,
  item_name text,
  price_paid int NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending', -- pending | fulfilled | rejected
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  fulfilled_at timestamptz,
  fulfilled_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.coin_redemption_requests TO authenticated;
GRANT ALL ON public.coin_redemption_requests TO service_role;
ALTER TABLE public.coin_redemption_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner sees own" ON public.coin_redemption_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin updates" ON public.coin_redemption_requests
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- purchase_shop_item を更新: auto_grant=false の場合は引き換えリクエストを作成 + 管理者通知
CREATE OR REPLACE FUNCTION public.purchase_shop_item(_item_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_item public.coin_shop_items; v_new_bal int; v_req_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO v_item FROM public.coin_shop_items WHERE id=_item_id AND is_active;
  IF v_item.id IS NULL THEN RAISE EXCEPTION 'アイテムが見つかりません'; END IF;
  IF NOT v_item.consumable AND v_item.auto_grant THEN
    IF EXISTS (SELECT 1 FROM public.user_inventory WHERE user_id=v_user AND item_code=v_item.code) THEN
      RAISE EXCEPTION '既に所有しています';
    END IF;
  END IF;
  v_new_bal := public.spend_coins(v_item.price, 'shop:'||v_item.code, jsonb_build_object('item_id', v_item.id));
  INSERT INTO public.coin_purchases(user_id, item_id, price_paid, payload) VALUES (v_user, v_item.id, v_item.price, v_item.payload);

  IF v_item.auto_grant THEN
    INSERT INTO public.user_inventory(user_id, item_code, category, quantity, payload)
      VALUES (v_user, v_item.code, v_item.category, 1, v_item.payload)
      ON CONFLICT (user_id, item_code) DO UPDATE SET quantity = public.user_inventory.quantity + 1;
  ELSE
    -- 引き換え式（LINEポイントなど） → 引き換えリクエストを作成し管理者へ通知
    INSERT INTO public.coin_redemption_requests(user_id, item_id, item_code, item_name, price_paid, payload)
    VALUES (v_user, v_item.id, v_item.code, v_item.name, v_item.price, v_item.payload)
    RETURNING id INTO v_req_id;
    INSERT INTO public.notifications(user_id, type, title, body, meta)
      SELECT ur.user_id, 'redemption_request', '引き換えリクエスト', v_item.name || ' (' || v_item.price || 'コイン)', jsonb_build_object('req_id', v_req_id, 'buyer', v_user)
      FROM public.user_roles ur WHERE ur.role = 'admin';
  END IF;
  RETURN jsonb_build_object('balance', v_new_bal, 'item', v_item.code, 'redemption', v_item.auto_grant = false);
END $$;

-- 管理者用: カスタム商品の追加/更新/削除（is_customのみ削除可）
CREATE OR REPLACE FUNCTION public.admin_upsert_shop_item(
  _id uuid, _code text, _name text, _description text, _price int,
  _category text, _payload jsonb, _is_active boolean, _consumable boolean,
  _auto_grant boolean, _sort_order int
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _id IS NULL THEN
    INSERT INTO public.coin_shop_items(code, name, description, price, category, payload, is_active, consumable, auto_grant, sort_order, is_custom)
    VALUES (_code, _name, _description, _price, _category, COALESCE(_payload,'{}'::jsonb), _is_active, _consumable, _auto_grant, COALESCE(_sort_order, 100), NOT _auto_grant)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.coin_shop_items SET
      code=_code, name=_name, description=_description, price=_price, category=_category,
      payload=COALESCE(_payload,'{}'::jsonb), is_active=_is_active, consumable=_consumable,
      auto_grant=_auto_grant, sort_order=COALESCE(_sort_order, sort_order)
    WHERE id=_id RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_fulfill_redemption(_req_id uuid, _approve boolean, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.coin_redemption_requests;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v FROM public.coin_redemption_requests WHERE id=_req_id;
  IF v.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  UPDATE public.coin_redemption_requests SET
    status = CASE WHEN _approve THEN 'fulfilled' ELSE 'rejected' END,
    admin_note = _note, fulfilled_at = now(), fulfilled_by = auth.uid()
  WHERE id=_req_id;
  IF NOT _approve THEN
    -- 返金
    UPDATE public.user_coins SET balance = balance + v.price_paid, updated_at=now() WHERE user_id=v.user_id;
    INSERT INTO public.coin_transactions(user_id, amount, reason, meta)
      VALUES (v.user_id, v.price_paid, 'refund:'||COALESCE(v.item_code,''), jsonb_build_object('req_id',_req_id,'note',_note));
  END IF;
  INSERT INTO public.notifications(user_id, type, title, body, meta)
    VALUES (v.user_id, 'redemption_'||CASE WHEN _approve THEN 'fulfilled' ELSE 'rejected' END,
      CASE WHEN _approve THEN '引き換えが完了しました' ELSE '引き換えが却下されました（返金）' END,
      COALESCE(v.item_name,'')||' ' || COALESCE(_note,''), jsonb_build_object('req_id',_req_id));
END $$;
