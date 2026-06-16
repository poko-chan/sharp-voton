
-- =========================================================
-- A) Makron: 階層ラベル(教科/分野/ユニット) + 権限なし問題作成
-- =========================================================

-- 1. 教科テーブル
CREATE TABLE IF NOT EXISTS public.makron_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text,
  icon text,
  order_idx int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.makron_subjects TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.makron_subjects TO authenticated;
GRANT ALL ON public.makron_subjects TO service_role;
ALTER TABLE public.makron_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subjects readable" ON public.makron_subjects FOR SELECT USING (true);
CREATE POLICY "subjects admin write" ON public.makron_subjects FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 2. 分野テーブル (教科に属する)
CREATE TABLE IF NOT EXISTS public.makron_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.makron_subjects(id) ON DELETE CASCADE,
  name text NOT NULL,
  order_idx int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_id, name)
);
GRANT SELECT ON public.makron_fields TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.makron_fields TO authenticated;
GRANT ALL ON public.makron_fields TO service_role;
ALTER TABLE public.makron_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fields readable" ON public.makron_fields FOR SELECT USING (true);
CREATE POLICY "fields admin write" ON public.makron_fields FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 3. makron_units に階層FKを追加 (旧 text カラムは残す=後方互換)
ALTER TABLE public.makron_units
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.makron_subjects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS field_id uuid REFERENCES public.makron_fields(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS organization_id uuid;

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_subjects_uat ON public.makron_subjects;
CREATE TRIGGER trg_subjects_uat BEFORE UPDATE ON public.makron_subjects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_fields_uat ON public.makron_fields;
CREATE TRIGGER trg_fields_uat BEFORE UPDATE ON public.makron_fields FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. 問題作成は権限不要に: makron_questions の INSERT ポリシー差し替え
DROP POLICY IF EXISTS "questions create by privileged" ON public.makron_questions;
DROP POLICY IF EXISTS "questions create by anyone" ON public.makron_questions;
CREATE POLICY "questions create by anyone" ON public.makron_questions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- =========================================================
-- B) Organizations (組織機能)
-- =========================================================

DO $$ BEGIN
  CREATE TYPE public.org_status AS ENUM ('pending','approved','rejected','suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.org_role AS ENUM ('owner','admin','teacher','member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  description text,
  status public.org_status NOT NULL DEFAULT 'pending',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.org_role NOT NULL DEFAULT 'member',
  suspended boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.organization_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.org_status NOT NULL DEFAULT 'pending',
  message text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_join_requests TO authenticated;
GRANT ALL ON public.organization_join_requests TO service_role;
ALTER TABLE public.organization_join_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.organization_service_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_key text NOT NULL,
  variant text NOT NULL DEFAULT 'stop',
  message text,
  until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, service_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_service_restrictions TO authenticated;
GRANT ALL ON public.organization_service_restrictions TO service_role;
ALTER TABLE public.organization_service_restrictions ENABLE ROW LEVEL SECURITY;

-- helpers
CREATE OR REPLACE FUNCTION public.is_org_member(_org uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.organization_members WHERE organization_id=_org AND user_id=_user AND NOT suspended)
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_org uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.organization_members WHERE organization_id=_org AND user_id=_user AND role IN ('owner','admin') AND NOT suspended)
$$;

CREATE OR REPLACE FUNCTION public.my_org_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT organization_id FROM public.organization_members WHERE user_id=auth.uid() AND NOT suspended
$$;

-- organizations policies
CREATE POLICY "org members can read" ON public.organizations FOR SELECT TO authenticated
  USING (status='approved' AND public.is_org_member(id, auth.uid()) OR public.has_role(auth.uid(),'admin') OR created_by=auth.uid());
CREATE POLICY "org create by anyone" ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (auth.uid()=created_by);
CREATE POLICY "org admin update" ON public.organizations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_org_admin(id, auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_org_admin(id, auth.uid()));

-- members policies
CREATE POLICY "members read own org" ON public.organization_members FOR SELECT TO authenticated
  USING (user_id=auth.uid() OR public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "members managed by org admin" ON public.organization_members FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));

-- join requests policies
CREATE POLICY "join req self read" ON public.organization_join_requests FOR SELECT TO authenticated
  USING (user_id=auth.uid() OR public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "join req self create" ON public.organization_join_requests FOR INSERT TO authenticated
  WITH CHECK (user_id=auth.uid());
CREATE POLICY "join req admin update" ON public.organization_join_requests FOR UPDATE TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));

-- restrictions policies
CREATE POLICY "org restrictions visible to members" ON public.organization_service_restrictions FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "org restrictions manage by org admin" ON public.organization_service_restrictions FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));

-- triggers
DROP TRIGGER IF EXISTS trg_org_uat ON public.organizations;
CREATE TRIGGER trg_org_uat BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- approval RPC for site admins
CREATE OR REPLACE FUNCTION public.admin_review_organization(_org_id uuid, _approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_org public.organizations;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_org FROM public.organizations WHERE id=_org_id;
  IF v_org.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  UPDATE public.organizations SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
    reviewed_by=auth.uid(), reviewed_at=now() WHERE id=_org_id;
  IF _approve THEN
    -- creator becomes owner
    INSERT INTO public.organization_members(organization_id, user_id, role)
      VALUES (_org_id, v_org.created_by, 'owner') ON CONFLICT DO NOTHING;
    INSERT INTO public.notifications(user_id,type,title,body) VALUES (v_org.created_by,'org_approved','組織が承認されました', v_org.name);
  ELSE
    INSERT INTO public.notifications(user_id,type,title,body) VALUES (v_org.created_by,'org_rejected','組織申請が却下されました', v_org.name);
  END IF;
END $$;

-- org admin: review join requests
CREATE OR REPLACE FUNCTION public.org_review_join_request(_req_id uuid, _approve boolean, _role public.org_role DEFAULT 'member')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.organization_join_requests;
BEGIN
  SELECT * INTO v FROM public.organization_join_requests WHERE id=_req_id;
  IF v.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF NOT (public.is_org_admin(v.organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.organization_join_requests SET status=CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
    reviewed_by=auth.uid(), reviewed_at=now() WHERE id=_req_id;
  IF _approve THEN
    INSERT INTO public.organization_members(organization_id, user_id, role) VALUES (v.organization_id, v.user_id, _role)
      ON CONFLICT (organization_id, user_id) DO UPDATE SET role=EXCLUDED.role, suspended=false;
    INSERT INTO public.notifications(user_id,type,title,body) VALUES (v.user_id,'org_member_approved','組織への参加が承認されました','');
  ELSE
    INSERT INTO public.notifications(user_id,type,title,body) VALUES (v.user_id,'org_member_rejected','組織への参加が却下されました','');
  END IF;
END $$;

-- =========================================================
-- C) Account Links (管理用 / 勉強用の切替)
-- =========================================================

CREATE TABLE IF NOT EXISTS public.account_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linked_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text,
  kind text NOT NULL DEFAULT 'study' CHECK (kind IN ('admin','study','other')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, linked_user_id),
  CHECK (owner_id <> linked_user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_links TO authenticated;
GRANT ALL ON public.account_links TO service_role;
ALTER TABLE public.account_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "links self read" ON public.account_links FOR SELECT TO authenticated
  USING (owner_id=auth.uid() OR linked_user_id=auth.uid());
CREATE POLICY "links self manage" ON public.account_links FOR ALL TO authenticated
  USING (owner_id=auth.uid()) WITH CHECK (owner_id=auth.uid());

-- =========================================================
-- D) Coin shop: 必ず5アイテム追加
-- =========================================================
INSERT INTO public.coin_shop_items(code,name,description,price,category,consumable,payload,is_active)
VALUES
 ('frame_aurora','オーロラフレーム','アバターに揺らめくオーロラ枠',360,'frame',false,'{"frame":"aurora"}'::jsonb,true),
 ('title_organizer','称号: 組織の創設者','組織を立ち上げた人の証',280,'title',false,'{"title":"組織の創設者"}'::jsonb,true),
 ('bg_classroom','背景: 教室','落ち着く木目の教室背景',200,'background',false,'{"background":"classroom"}'::jsonb,true),
 ('ticket_org_apply','組織申請チケット','組織申請を即時提出（運営審査は通常通り）',150,'ticket',true,'{"ticket":"org_apply"}'::jsonb,true),
 ('frame_marble','大理石フレーム','上品な大理石風のアバター枠',420,'frame',false,'{"frame":"marble"}'::jsonb,true)
ON CONFLICT (code) DO NOTHING;
