
-- 1. notifications.meta 列追加（致命的バグ修正）
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. user_inventory.updated_at 追加
ALTER TABLE public.user_inventory ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 3. follows: 受信者が承認/拒否できる UPDATE/DELETE ポリシー
DROP POLICY IF EXISTS "fl_update_recipient" ON public.follows;
CREATE POLICY "fl_update_recipient" ON public.follows FOR UPDATE TO authenticated
  USING (auth.uid() = following_id) WITH CHECK (auth.uid() = following_id);
DROP POLICY IF EXISTS "fl_delete_recipient" ON public.follows;
CREATE POLICY "fl_delete_recipient" ON public.follows FOR DELETE TO authenticated
  USING (auth.uid() = following_id);

-- 4. profiles.current_plan
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_plan text NOT NULL DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text;
UPDATE public.profiles SET referral_code = upper(substr(replace(id::text,'-',''),1,8)) WHERE referral_code IS NULL;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_referral_code_key UNIQUE (referral_code);

-- 5. user_referrals
CREATE TABLE IF NOT EXISTS public.user_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_granted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(referred_id)
);
GRANT SELECT, INSERT ON public.user_referrals TO authenticated;
GRANT ALL ON public.user_referrals TO service_role;
ALTER TABLE public.user_referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ref_select" ON public.user_referrals;
CREATE POLICY "ref_select" ON public.user_referrals FOR SELECT TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "ref_insert_self" ON public.user_referrals;
CREATE POLICY "ref_insert_self" ON public.user_referrals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = referred_id);

-- 6. handle_new_user: referral_code を自動付与
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, username, display_name, account_kind, referral_code)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'account_kind', 'child'),
    upper(substr(replace(NEW.id::text,'-',''),1,8))
  ) ON CONFLICT (id) DO UPDATE SET account_kind = EXCLUDED.account_kind;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $function$;

-- 7. claim_referral: 新規ユーザーが招待コードを使った時に呼ぶ。双方に10コイン
CREATE OR REPLACE FUNCTION public.claim_referral(_code text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_user uuid := auth.uid(); v_referrer uuid; v_acct_age interval;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT id INTO v_referrer FROM public.profiles WHERE referral_code = upper(trim(_code));
  IF v_referrer IS NULL THEN RAISE EXCEPTION '招待コードが見つかりません'; END IF;
  IF v_referrer = v_user THEN RAISE EXCEPTION '自分の招待コードは使えません'; END IF;
  SELECT now() - created_at INTO v_acct_age FROM auth.users WHERE id = v_user;
  IF v_acct_age > interval '7 days' THEN RAISE EXCEPTION '招待コードは登録から7日以内のみ使えます'; END IF;
  IF EXISTS(SELECT 1 FROM public.user_referrals WHERE referred_id = v_user) THEN
    RAISE EXCEPTION '既に招待コードを使用済みです'; END IF;
  INSERT INTO public.user_referrals(referrer_id, referred_id, reward_granted) VALUES (v_referrer, v_user, true);
  -- 双方に 10 コイン
  INSERT INTO public.user_coins(user_id, balance, total_earned) VALUES (v_user, 10, 10)
    ON CONFLICT (user_id) DO UPDATE SET balance = public.user_coins.balance + 10,
      total_earned = public.user_coins.total_earned + 10, updated_at = now();
  INSERT INTO public.coin_transactions(user_id, amount, reason, meta) VALUES (v_user, 10, 'referral_bonus', jsonb_build_object('referrer', v_referrer));
  INSERT INTO public.user_coins(user_id, balance, total_earned) VALUES (v_referrer, 10, 10)
    ON CONFLICT (user_id) DO UPDATE SET balance = public.user_coins.balance + 10,
      total_earned = public.user_coins.total_earned + 10, updated_at = now();
  INSERT INTO public.coin_transactions(user_id, amount, reason, meta) VALUES (v_referrer, 10, 'referral_reward', jsonb_build_object('referred', v_user));
  INSERT INTO public.notifications(user_id, type, title, body, meta)
    VALUES (v_referrer, 'referral', '招待ボーナスを獲得', '友達があなたの招待で登録しました (+10コイン)', jsonb_build_object('referred', v_user));
  RETURN jsonb_build_object('ok', true);
END $function$;

-- 8. 招待者ランキング
CREATE OR REPLACE FUNCTION public.get_referral_leaderboard(_limit int DEFAULT 20)
 RETURNS TABLE(user_id uuid, display_name text, avatar_url text, invite_count bigint, rank bigint)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT p.id, p.display_name, p.avatar_url,
    COALESCE(c.invite_count,0)::bigint AS invite_count,
    RANK() OVER (ORDER BY COALESCE(c.invite_count,0) DESC) AS rank
  FROM public.profiles p
  LEFT JOIN (SELECT referrer_id, count(*) AS invite_count FROM public.user_referrals GROUP BY referrer_id) c
    ON c.referrer_id = p.id
  WHERE c.invite_count IS NOT NULL AND c.invite_count > 0
  ORDER BY invite_count DESC LIMIT _limit
$function$;

-- 9. purchase_shop_item: 負の価格対応（負ならコイン付与）
CREATE OR REPLACE FUNCTION public.purchase_shop_item(_item_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_user uuid := auth.uid(); v_item public.coin_shop_items; v_new_bal int; v_req_id uuid; v_price int;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO v_item FROM public.coin_shop_items WHERE id=_item_id AND is_active;
  IF v_item.id IS NULL THEN RAISE EXCEPTION 'アイテムが見つかりません'; END IF;
  v_price := COALESCE(v_item.price, 0);
  IF NOT v_item.consumable AND v_item.auto_grant THEN
    IF EXISTS (SELECT 1 FROM public.user_inventory WHERE user_id=v_user AND item_code=v_item.code) THEN
      RAISE EXCEPTION '既に所有しています';
    END IF;
  END IF;
  IF v_price > 0 THEN
    v_new_bal := public.spend_coins(v_price, 'shop:'||v_item.code, jsonb_build_object('item_id', v_item.id));
  ELSIF v_price < 0 THEN
    -- 負の価格：コイン付与
    INSERT INTO public.user_coins(user_id, balance, total_earned) VALUES (v_user, -v_price, -v_price)
      ON CONFLICT (user_id) DO UPDATE SET balance = public.user_coins.balance + (-v_price),
        total_earned = public.user_coins.total_earned + (-v_price), updated_at = now();
    INSERT INTO public.coin_transactions(user_id, amount, reason, meta)
      VALUES (v_user, -v_price, 'shop_bonus:'||v_item.code, jsonb_build_object('item_id', v_item.id));
    SELECT balance INTO v_new_bal FROM public.user_coins WHERE user_id = v_user;
  ELSE
    SELECT COALESCE(balance,0) INTO v_new_bal FROM public.user_coins WHERE user_id=v_user;
    INSERT INTO public.coin_transactions(user_id, amount, reason, meta)
      VALUES (v_user, 0, 'shop_free:'||v_item.code, jsonb_build_object('item_id', v_item.id));
  END IF;
  INSERT INTO public.coin_purchases(user_id, item_id, price_paid, payload) VALUES (v_user, v_item.id, v_price, v_item.payload);
  IF v_item.auto_grant THEN
    INSERT INTO public.user_inventory(user_id, item_code, category, quantity, payload)
      VALUES (v_user, v_item.code, v_item.category, 1, v_item.payload)
      ON CONFLICT (user_id, item_code) DO UPDATE SET quantity = public.user_inventory.quantity + 1, updated_at = now();
  ELSE
    INSERT INTO public.coin_redemption_requests(user_id, item_id, item_code, item_name, price_paid, payload)
      VALUES (v_user, v_item.id, v_item.code, v_item.name, v_price, v_item.payload) RETURNING id INTO v_req_id;
    INSERT INTO public.notifications(user_id, type, title, body, meta)
      SELECT ur.user_id, 'redemption_request', '引き換えリクエスト', v_item.name || ' (' || v_price || 'コイン)', jsonb_build_object('req_id', v_req_id, 'buyer', v_user)
      FROM public.user_roles ur WHERE ur.role = 'admin';
  END IF;
  RETURN jsonb_build_object('balance', v_new_bal, 'item', v_item.code, 'redemption', v_item.auto_grant = false);
END $function$;

-- 10. sell_inventory_item: 半額返金
CREATE OR REPLACE FUNCTION public.sell_inventory_item(_item_code text, _qty int DEFAULT 1)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_user uuid := auth.uid(); v_have int; v_price int; v_refund int; v_new_bal int;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _qty < 1 THEN RAISE EXCEPTION '個数が不正です'; END IF;
  SELECT quantity INTO v_have FROM public.user_inventory WHERE user_id=v_user AND item_code=_item_code FOR UPDATE;
  IF v_have IS NULL OR v_have < _qty THEN RAISE EXCEPTION '在庫がありません'; END IF;
  SELECT price INTO v_price FROM public.coin_shop_items WHERE code = _item_code;
  v_refund := GREATEST(0, FLOOR(COALESCE(v_price,0) / 2)::int) * _qty;
  UPDATE public.user_inventory SET quantity = quantity - _qty, updated_at = now() WHERE user_id=v_user AND item_code=_item_code;
  DELETE FROM public.user_inventory WHERE user_id=v_user AND item_code=_item_code AND quantity <= 0;
  IF v_refund > 0 THEN
    INSERT INTO public.user_coins(user_id, balance, total_earned) VALUES (v_user, v_refund, 0)
      ON CONFLICT (user_id) DO UPDATE SET balance = public.user_coins.balance + v_refund, updated_at = now();
    INSERT INTO public.coin_transactions(user_id, amount, reason, meta)
      VALUES (v_user, v_refund, 'sell:'||_item_code, jsonb_build_object('qty',_qty));
  END IF;
  SELECT balance INTO v_new_bal FROM public.user_coins WHERE user_id=v_user;
  RETURN jsonb_build_object('refund', v_refund, 'balance', v_new_bal);
END $function$;

-- 11. gift_inventory_item: フレンドに譲渡
CREATE OR REPLACE FUNCTION public.gift_inventory_item(_to uuid, _item_code text, _qty int DEFAULT 1, _message text DEFAULT NULL)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_user uuid := auth.uid(); v_have int; v_cat text; v_payload jsonb;
BEGIN
  IF v_user IS NULL OR _to IS NULL OR v_user=_to THEN RAISE EXCEPTION '不正な送付先'; END IF;
  IF NOT public.are_mutual_friends(v_user,_to) THEN RAISE EXCEPTION 'フレンドのみ送付可能'; END IF;
  IF _qty < 1 THEN RAISE EXCEPTION '個数が不正'; END IF;
  SELECT quantity, category, payload INTO v_have, v_cat, v_payload
    FROM public.user_inventory WHERE user_id=v_user AND item_code=_item_code FOR UPDATE;
  IF v_have IS NULL OR v_have < _qty THEN RAISE EXCEPTION '在庫がありません'; END IF;
  UPDATE public.user_inventory SET quantity = quantity - _qty, updated_at=now() WHERE user_id=v_user AND item_code=_item_code;
  DELETE FROM public.user_inventory WHERE user_id=v_user AND item_code=_item_code AND quantity <= 0;
  INSERT INTO public.user_inventory(user_id, item_code, category, quantity, payload)
    VALUES (_to, _item_code, v_cat, _qty, COALESCE(v_payload,'{}'::jsonb))
    ON CONFLICT (user_id, item_code) DO UPDATE SET quantity = public.user_inventory.quantity + _qty, updated_at = now();
  INSERT INTO public.notifications(user_id, type, title, body, meta)
    VALUES (_to, 'item_gift', 'アイテムが届きました',
      COALESCE((SELECT name FROM public.coin_shop_items WHERE code=_item_code),_item_code)||' ×'||_qty||' '||COALESCE(_message,''),
      jsonb_build_object('from',v_user,'item_code',_item_code,'qty',_qty));
END $function$;

-- 12. use_inventory_item: フレーム/テーマ/称号の装備＋消費型は単純消費
CREATE OR REPLACE FUNCTION public.use_inventory_item(_item_code text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_user uuid := auth.uid(); v_cat text; v_payload jsonb; v_have int;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT category, payload, quantity INTO v_cat, v_payload, v_have
    FROM public.user_inventory WHERE user_id=v_user AND item_code=_item_code;
  IF v_have IS NULL OR v_have < 1 THEN RAISE EXCEPTION '所持していません'; END IF;
  IF v_cat = 'frame' THEN
    UPDATE public.profiles SET active_frame = COALESCE(v_payload->>'frame',_item_code) WHERE id=v_user;
  ELSIF v_cat = 'theme' THEN
    UPDATE public.profiles SET active_theme = COALESCE(v_payload->>'theme',_item_code) WHERE id=v_user;
  ELSIF v_cat = 'title' THEN
    UPDATE public.profiles SET active_title = COALESCE(v_payload->>'title',_item_code) WHERE id=v_user;
  ELSIF v_cat = 'chest' THEN
    -- ランダムコイン 10-100
    DECLARE v_reward int := 10 + floor(random()*91)::int;
    BEGIN
      INSERT INTO public.user_coins(user_id, balance, total_earned) VALUES (v_user, v_reward, v_reward)
        ON CONFLICT (user_id) DO UPDATE SET balance = public.user_coins.balance + v_reward,
          total_earned = public.user_coins.total_earned + v_reward, updated_at=now();
      INSERT INTO public.coin_transactions(user_id, amount, reason, meta)
        VALUES (v_user, v_reward, 'chest:'||_item_code, jsonb_build_object('reward',v_reward));
      UPDATE public.user_inventory SET quantity = quantity - 1, updated_at=now() WHERE user_id=v_user AND item_code=_item_code;
      DELETE FROM public.user_inventory WHERE user_id=v_user AND item_code=_item_code AND quantity <= 0;
      RETURN jsonb_build_object('reward',v_reward);
    END;
  ELSE
    -- 消費型（hint/revive/boost等）
    UPDATE public.user_inventory SET quantity = quantity - 1, updated_at=now() WHERE user_id=v_user AND item_code=_item_code;
    DELETE FROM public.user_inventory WHERE user_id=v_user AND item_code=_item_code AND quantity <= 0;
  END IF;
  RETURN jsonb_build_object('ok',true,'category',v_cat);
END $function$;

-- 13. 自分のプロフィール referral_code を返す簡易ビューはいらない、SELECT で十分
