
DELETE FROM public.coin_purchases;
DELETE FROM public.user_inventory;
DELETE FROM public.coin_transactions;
DELETE FROM public.coin_gifts;
UPDATE public.user_coins SET balance = 0, total_earned = 0, updated_at = now();
DELETE FROM public.temp_question_creators;
DELETE FROM public.coin_shop_items WHERE category = 'privilege';

INSERT INTO public.coin_shop_items (code, category, name, description, price, payload, consumable, sort_order) VALUES
  ('frame_diamond',   'frame',  'ダイヤモンドフレーム',  '輝くダイヤ装飾',  1500, '{"frame":"diamond"}'::jsonb,  false, 10),
  ('frame_fire',      'frame',  '炎フレーム',           '燃える枠線',       700,  '{"frame":"fire"}'::jsonb,     false, 11),
  ('frame_ice',       'frame',  '氷フレーム',           'クールな氷の枠',   700,  '{"frame":"ice"}'::jsonb,      false, 12),
  ('theme_pastel',    'theme',  'パステルテーマ',        '柔らかい色合い',  500,  '{"theme":"pastel"}'::jsonb,   false, 20),
  ('theme_midnight',  'theme',  'ミッドナイト',          '深い藍色テーマ',  600,  '{"theme":"midnight"}'::jsonb, false, 21),
  ('theme_retro',     'theme',  'レトロテーマ',          '80年代風',        650,  '{"theme":"retro"}'::jsonb,    false, 22),
  ('title_hero',      'title',  '〈勇者〉',              '勇敢な学習者',    600,  '{"title":"〈勇者〉"}'::jsonb, false, 30),
  ('title_sage',      'title',  '〈賢者〉',              '知恵者の称号',   1000, '{"title":"〈賢者〉"}'::jsonb, false, 31),
  ('title_phoenix',   'title',  '〈不死鳥〉',            '何度でも蘇る',   2500, '{"title":"〈不死鳥〉"}'::jsonb, false, 32),
  ('title_emperor',   'title',  '〈皇帝〉',              '最強の称号',     5000, '{"title":"〈皇帝〉"}'::jsonb, false, 33),
  ('decor_halo',      'decor',  '天使の輪',              '頭上の輪',        500,  '{"decor":"halo"}'::jsonb,     false, 40),
  ('decor_horns',     'decor',  '悪魔の角',              'やんちゃな角',    500,  '{"decor":"horns"}'::jsonb,    false, 41),
  ('hint_pack50',     'hint',   'ヒント券×50',           'まとめてお得',   1000, '{"qty":50}'::jsonb,           true,  50),
  ('chest_mythic',    'chest',  '伝説の宝箱',            '超レア確定',     2000, '{}'::jsonb,                   true,  60),
  ('boost_xp_24h',    'boost',  'XP2倍 24時間',         '丸一日XP2倍',    1500, '{"mult":2,"hours":24}'::jsonb,true,  70),
  ('boost_coin_1h',   'boost',  'コイン2倍 1時間',       'コイン獲得量倍増',400, '{"mult":2,"hours":1}'::jsonb, true,  71),
  ('scratch_music',   'scratch', '五線譜計算用紙',         '音楽もOK',     150,  '{"style":"music"}'::jsonb,    false, 80),
  ('emoji_animals',   'emoji',  '動物絵文字',            'チャット用',      300,  '{}'::jsonb,                   false, 81),
  ('emoji_food',      'emoji',  '食べ物絵文字',          'チャット用',      300,  '{}'::jsonb,                   false, 82),
  ('revive_pack5',    'revive', 'ストリーク復活×5',      '5回まで復活',     800,  '{"qty":5}'::jsonb,            true,  90)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.coin_gift_limits (
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT current_date,
  gift_count int NOT NULL DEFAULT 0,
  total_sent int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);
GRANT SELECT ON public.coin_gift_limits TO authenticated;
GRANT ALL ON public.coin_gift_limits TO service_role;
ALTER TABLE public.coin_gift_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self read gift limits" ON public.coin_gift_limits;
CREATE POLICY "self read gift limits" ON public.coin_gift_limits FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.send_coin_gift(_to uuid, _amount integer, _message text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_new int; v_tax int; v_net int; v_acct_age interval; v_today public.coin_gift_limits;
BEGIN
  IF v_user IS NULL OR _to IS NULL OR v_user = _to THEN RAISE EXCEPTION '不正な送付先'; END IF;
  IF _amount < 10 THEN RAISE EXCEPTION '最低10コインから送付できます'; END IF;
  IF NOT public.are_mutual_friends(v_user, _to) THEN RAISE EXCEPTION 'フレンドのみ送付可能'; END IF;
  SELECT now() - created_at INTO v_acct_age FROM auth.users WHERE id = v_user;
  IF v_acct_age < interval '1 day' THEN RAISE EXCEPTION 'アカウント作成から24時間経過後に送付可能になります'; END IF;
  SELECT * INTO v_today FROM public.coin_gift_limits WHERE user_id=v_user AND date=current_date FOR UPDATE;
  IF v_today.user_id IS NULL THEN
    INSERT INTO public.coin_gift_limits(user_id,date,gift_count,total_sent) VALUES (v_user,current_date,0,0);
    v_today.gift_count := 0; v_today.total_sent := 0;
  END IF;
  IF v_today.gift_count >= 3 THEN RAISE EXCEPTION '1日3回までしか送付できません'; END IF;
  IF v_today.total_sent + _amount > 500 THEN RAISE EXCEPTION '1日合計500コインまでです'; END IF;
  v_tax := CEIL(_amount * 0.10);
  v_net := _amount - v_tax;
  v_new := public.spend_coins(_amount, 'gift_to:'||_to::text, jsonb_build_object('to',_to,'msg',_message,'tax',v_tax,'net',v_net));
  INSERT INTO public.user_coins(user_id, balance, total_earned)
    VALUES (_to, v_net, v_net)
    ON CONFLICT (user_id) DO UPDATE SET balance = public.user_coins.balance + v_net,
      total_earned = public.user_coins.total_earned + v_net, updated_at=now();
  INSERT INTO public.coin_transactions(user_id, amount, reason, meta) VALUES (_to, v_net, 'gift_from:'||v_user::text, jsonb_build_object('from',v_user,'msg',_message,'tax',v_tax));
  INSERT INTO public.coin_gifts(from_user, to_user, amount, message) VALUES (v_user, _to, v_net, _message);
  UPDATE public.coin_gift_limits SET gift_count = gift_count + 1, total_sent = total_sent + _amount WHERE user_id=v_user AND date=current_date;
  RETURN jsonb_build_object('balance', v_new, 'sent', v_net, 'tax', v_tax);
END $$;

CREATE OR REPLACE FUNCTION public.admin_grant_coins(_user_id uuid, _amount integer, _message text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _amount = 0 THEN RAISE EXCEPTION 'amount must be non-zero'; END IF;
  INSERT INTO public.user_coins(user_id, balance, total_earned)
    VALUES (_user_id, GREATEST(0, _amount), GREATEST(0, _amount))
    ON CONFLICT (user_id) DO UPDATE SET
      balance = GREATEST(0, public.user_coins.balance + _amount),
      total_earned = public.user_coins.total_earned + GREATEST(0, _amount),
      updated_at = now();
  INSERT INTO public.coin_transactions(user_id, amount, reason, meta)
    VALUES (_user_id, _amount, 'admin_grant', jsonb_build_object('by',auth.uid(),'msg',_message));
  INSERT INTO public.notifications(user_id, type, title, body, meta)
    VALUES (_user_id, 'admin_coin', '管理者からコインが届きました', COALESCE(_message,'')||' ('||_amount||'コイン)', jsonb_build_object('amount',_amount));
  INSERT INTO public.admin_audit_log(admin_id,action,target_user,details)
    VALUES (auth.uid(),'grant_coins',_user_id,jsonb_build_object('amount',_amount,'msg',_message));
END $$;

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  target_user uuid,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin read audit" ON public.admin_audit_log;
CREATE POLICY "admin read audit" ON public.admin_audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "admin write audit" ON public.admin_audit_log;
CREATE POLICY "admin write audit" ON public.admin_audit_log FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.question_creator_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  duration_days int NOT NULL DEFAULT 7,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.question_creator_applications TO authenticated;
GRANT ALL ON public.question_creator_applications TO service_role;
ALTER TABLE public.question_creator_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self read app" ON public.question_creator_applications;
CREATE POLICY "self read app" ON public.question_creator_applications FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "self apply" ON public.question_creator_applications;
CREATE POLICY "self apply" ON public.question_creator_applications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "admin update" ON public.question_creator_applications;
CREATE POLICY "admin update" ON public.question_creator_applications FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.admin_review_creator_application(_app_id uuid, _approve boolean, _days int DEFAULT 7)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_app public.question_creator_applications;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_app FROM public.question_creator_applications WHERE id=_app_id FOR UPDATE;
  IF v_app.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  UPDATE public.question_creator_applications
    SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
        reviewed_by = auth.uid(), reviewed_at = now(), duration_days = _days
    WHERE id = _app_id;
  IF _approve THEN
    INSERT INTO public.temp_question_creators(user_id, granted_by, expires_at, reason)
      VALUES (v_app.user_id, auth.uid(), now() + (_days || ' days')::interval, 'application approved');
    INSERT INTO public.notifications(user_id,type,title,body)
      VALUES (v_app.user_id,'creator_approved','問題作成権限が承認されました', _days || '日間有効です');
  ELSE
    INSERT INTO public.notifications(user_id,type,title,body)
      VALUES (v_app.user_id,'creator_rejected','問題作成権限の申請が却下されました','管理者にお問い合わせください');
  END IF;
  INSERT INTO public.admin_audit_log(admin_id,action,target_user,details)
    VALUES (auth.uid(), CASE WHEN _approve THEN 'approve_creator' ELSE 'reject_creator' END, v_app.user_id, jsonb_build_object('days',_days));
END $$;

CREATE OR REPLACE FUNCTION public.consume_inventory(_item_code text, _qty int DEFAULT 1)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_remaining int;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT quantity INTO v_remaining FROM public.user_inventory WHERE user_id=v_user AND item_code=_item_code FOR UPDATE;
  IF v_remaining IS NULL OR v_remaining < _qty THEN RAISE EXCEPTION '在庫がありません'; END IF;
  UPDATE public.user_inventory SET quantity = quantity - _qty, updated_at = now()
    WHERE user_id=v_user AND item_code=_item_code;
  RETURN v_remaining - _qty;
END $$;

ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS makron_coin_per_correct int NOT NULL DEFAULT 2;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS makron_xp_per_correct int NOT NULL DEFAULT 10;
ALTER TABLE public.user_coins ADD COLUMN IF NOT EXISTS daily_earned_date date;
ALTER TABLE public.user_coins ADD COLUMN IF NOT EXISTS daily_earned int NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.finalize_makron_session(_session_id uuid)
RETURNS TABLE(total_score integer, total_points integer, xp_awarded integer, coins_awarded integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid; v_total_points int := 0; v_score int := 0;
  v_xp int := 0; v_coins int := 0; v_correct int := 0; v_wrong int := 0;
  v_rate_coin int := 2; v_rate_xp int := 10;
  v_cap int := 200; v_today_earned int := 0; v_today_date date;
BEGIN
  SELECT user_id INTO v_user FROM public.makron_sessions WHERE id = _session_id;
  IF v_user IS NULL OR v_user <> auth.uid() THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT COALESCE(makron_coin_per_correct,2), COALESCE(makron_xp_per_correct,10)
    INTO v_rate_coin, v_rate_xp FROM public.app_settings WHERE id=1;

  SELECT
    COALESCE(SUM(CASE WHEN q.grading='manual' AND a.manual_score IS NULL THEN 0 ELSE q.points END), 0),
    COALESCE(SUM(CASE WHEN q.grading='manual' AND a.manual_score IS NOT NULL THEN a.manual_score
                       WHEN q.grading='auto' AND a.auto_correct THEN q.points ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN (q.grading='auto' AND a.auto_correct) OR (q.grading='manual' AND a.manual_score IS NOT NULL AND a.manual_score >= q.points) THEN 1 ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN (q.grading='auto' AND a.auto_correct = false) THEN 1 ELSE 0 END),0)
  INTO v_total_points, v_score, v_correct, v_wrong
  FROM public.makron_answers a
  JOIN public.makron_questions q ON q.id = a.question_id
  WHERE a.session_id = _session_id;

  v_xp := v_correct * v_rate_xp + v_wrong * 2;
  v_coins := v_correct * v_rate_coin;

  SELECT daily_earned_date, daily_earned INTO v_today_date, v_today_earned FROM public.user_coins WHERE user_id=v_user;
  IF v_today_date IS DISTINCT FROM current_date THEN v_today_earned := 0; END IF;
  IF v_today_earned + v_coins > v_cap THEN v_coins := GREATEST(0, v_cap - v_today_earned); END IF;

  UPDATE public.makron_sessions
    SET finished_at = COALESCE(finished_at, now()),
        total_score = v_score, total_points = v_total_points,
        xp_awarded = v_xp, coins_awarded = v_coins
  WHERE id = _session_id;

  INSERT INTO public.makron_xp(user_id, xp, level)
    VALUES (v_user, v_xp, GREATEST(1, floor(sqrt(v_xp::numeric/50))::int + 1))
    ON CONFLICT (user_id) DO UPDATE
    SET xp = public.makron_xp.xp + EXCLUDED.xp,
        level = GREATEST(1, floor(sqrt((public.makron_xp.xp + EXCLUDED.xp)::numeric/50))::int + 1),
        updated_at = now();

  IF v_coins > 0 THEN
    INSERT INTO public.user_coins(user_id, balance, total_earned, daily_earned_date, daily_earned)
      VALUES (v_user, v_coins, v_coins, current_date, v_coins)
      ON CONFLICT (user_id) DO UPDATE
      SET balance = public.user_coins.balance + EXCLUDED.balance,
          total_earned = public.user_coins.total_earned + EXCLUDED.total_earned,
          daily_earned_date = current_date,
          daily_earned = CASE WHEN public.user_coins.daily_earned_date IS DISTINCT FROM current_date THEN v_coins
                              ELSE public.user_coins.daily_earned + v_coins END,
          updated_at = now();
  END IF;

  RETURN QUERY SELECT v_score, v_total_points, v_xp, v_coins;
END $$;
