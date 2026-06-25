
-- A. Daily practice infrastructure
ALTER TABLE public.makron_sessions
  ADD COLUMN IF NOT EXISTS question_ids uuid[],
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'unit',
  ADD COLUMN IF NOT EXISTS daily_date date;

CREATE TABLE IF NOT EXISTS public.makron_daily_sets (
  date date PRIMARY KEY,
  question_ids uuid[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.makron_daily_sets TO authenticated;
GRANT ALL ON public.makron_daily_sets TO service_role;
ALTER TABLE public.makron_daily_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily sets readable" ON public.makron_daily_sets FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.makron_daily_completions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  session_id uuid REFERENCES public.makron_sessions(id) ON DELETE SET NULL,
  score int NOT NULL DEFAULT 0,
  total int NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);
GRANT SELECT, INSERT, UPDATE ON public.makron_daily_completions TO authenticated;
GRANT ALL ON public.makron_daily_completions TO service_role;
ALTER TABLE public.makron_daily_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own daily completions read" ON public.makron_daily_completions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own daily completions write" ON public.makron_daily_completions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- helper: JST today
CREATE OR REPLACE FUNCTION public.jst_today() RETURNS date
LANGUAGE sql STABLE AS $$ SELECT (now() AT TIME ZONE 'Asia/Tokyo')::date $$;

-- Get or create today's daily set (10 approved active questions, deterministic per day)
CREATE OR REPLACE FUNCTION public.makron_get_or_create_daily_set()
RETURNS TABLE(date date, question_ids uuid[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_date date := public.jst_today();
  v_ids uuid[];
BEGIN
  SELECT s.question_ids INTO v_ids FROM public.makron_daily_sets s WHERE s.date = v_date;
  IF v_ids IS NULL THEN
    SELECT array_agg(id ORDER BY id) INTO v_ids FROM (
      SELECT q.id FROM public.makron_questions q
      WHERE q.status = 'approved' AND COALESCE(q.is_active, true) = true
      ORDER BY md5(q.id::text || v_date::text)
      LIMIT 10
    ) t;
    IF v_ids IS NULL OR array_length(v_ids,1) IS NULL THEN
      v_ids := ARRAY[]::uuid[];
    END IF;
    INSERT INTO public.makron_daily_sets(date, question_ids) VALUES (v_date, v_ids)
      ON CONFLICT (date) DO UPDATE SET question_ids = EXCLUDED.question_ids
      RETURNING makron_daily_sets.question_ids INTO v_ids;
  END IF;
  RETURN QUERY SELECT v_date, v_ids;
END $$;
GRANT EXECUTE ON FUNCTION public.makron_get_or_create_daily_set() TO authenticated;

-- Start a daily session (one per JST day per user; returns existing if not finished)
CREATE OR REPLACE FUNCTION public.makron_start_daily_session()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_date date := public.jst_today();
  v_ids uuid[];
  v_session uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  -- already completed?
  IF EXISTS (SELECT 1 FROM public.makron_daily_completions WHERE user_id = v_user AND date = v_date) THEN
    RAISE EXCEPTION 'today_completed';
  END IF;
  -- in-progress session?
  SELECT id INTO v_session FROM public.makron_sessions
    WHERE user_id = v_user AND kind = 'daily' AND daily_date = v_date AND finished_at IS NULL
    ORDER BY started_at DESC LIMIT 1;
  IF v_session IS NOT NULL THEN RETURN v_session; END IF;

  SELECT question_ids INTO v_ids FROM public.makron_get_or_create_daily_set();
  IF v_ids IS NULL OR array_length(v_ids,1) IS NULL OR array_length(v_ids,1) = 0 THEN
    RAISE EXCEPTION 'no_questions_available';
  END IF;

  INSERT INTO public.makron_sessions(user_id, kind, daily_date, question_ids)
    VALUES (v_user, 'daily', v_date, v_ids) RETURNING id INTO v_session;
  RETURN v_session;
END $$;
GRANT EXECUTE ON FUNCTION public.makron_start_daily_session() TO authenticated;

-- Wrap finalize to record completion + bonus
CREATE OR REPLACE FUNCTION public.makron_finalize_daily(_session_id uuid)
RETURNS TABLE(total_score int, total_points int, xp_awarded int, coins_awarded int, bonus_xp int, bonus_coins int, streak int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_kind text; v_date date; v_score int; v_total int;
  v_xp int; v_coins int; v_bxp int := 0; v_bcoins int := 0;
  v_streak int := 0;
  r record;
BEGIN
  SELECT kind, daily_date INTO v_kind, v_date FROM public.makron_sessions WHERE id = _session_id AND user_id = v_user;
  IF v_kind IS NULL THEN RAISE EXCEPTION 'not found'; END IF;

  SELECT * INTO r FROM public.finalize_makron_session(_session_id);
  v_score := r.total_score; v_total := r.total_points; v_xp := r.xp_awarded; v_coins := r.coins_awarded;

  IF v_kind = 'daily' AND NOT EXISTS (
    SELECT 1 FROM public.makron_daily_completions WHERE user_id=v_user AND date=v_date
  ) THEN
    v_bxp := 50; v_bcoins := 20;
    -- daily completion bonus
    INSERT INTO public.makron_xp(user_id, xp, level) VALUES (v_user, v_bxp, 1)
      ON CONFLICT (user_id) DO UPDATE
      SET xp = public.makron_xp.xp + EXCLUDED.xp,
          level = GREATEST(1, floor(sqrt((public.makron_xp.xp + EXCLUDED.xp)::numeric/50))::int + 1),
          updated_at = now();
    INSERT INTO public.user_coins(user_id, balance, total_earned, daily_earned_date, daily_earned)
      VALUES (v_user, v_bcoins, v_bcoins, current_date, v_bcoins)
      ON CONFLICT (user_id) DO UPDATE
      SET balance = public.user_coins.balance + EXCLUDED.balance,
          total_earned = public.user_coins.total_earned + EXCLUDED.total_earned;
    INSERT INTO public.makron_daily_completions(user_id, date, session_id, score, total)
      VALUES (v_user, v_date, _session_id, v_score, v_total);
  END IF;

  -- compute streak
  SELECT count(*) INTO v_streak FROM (
    SELECT generate_series(0, 365) AS i
  ) g WHERE EXISTS (
    SELECT 1 FROM public.makron_daily_completions c
    WHERE c.user_id = v_user AND c.date = (public.jst_today() - g.i)
  ) AND NOT EXISTS (
    SELECT 1 FROM generate_series(0, g.i - 1) gg
    WHERE NOT EXISTS (
      SELECT 1 FROM public.makron_daily_completions c2
      WHERE c2.user_id = v_user AND c2.date = (public.jst_today() - gg)
    )
  );

  RETURN QUERY SELECT v_score, v_total, v_xp, v_coins, v_bxp, v_bcoins, v_streak;
END $$;
GRANT EXECUTE ON FUNCTION public.makron_finalize_daily(uuid) TO authenticated;

-- Daily status helper
CREATE OR REPLACE FUNCTION public.makron_daily_status()
RETURNS TABLE(date date, completed boolean, streak int, total_questions int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_date date := public.jst_today();
  v_completed boolean;
  v_streak int := 0;
  v_total int := 0;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.makron_daily_completions WHERE user_id=v_user AND date=v_date) INTO v_completed;
  SELECT COALESCE(array_length(question_ids,1),0) INTO v_total FROM public.makron_daily_sets WHERE date=v_date;
  -- streak: consecutive days ending today (or yesterday if not done today)
  WITH RECURSIVE walk AS (
    SELECT v_date AS d, 0 AS n
    UNION ALL
    SELECT (w.d - 1), w.n + 1 FROM walk w
    WHERE EXISTS (SELECT 1 FROM public.makron_daily_completions c WHERE c.user_id=v_user AND c.date=w.d)
      AND w.n < 365
  )
  SELECT COALESCE(MAX(n+1) FILTER (WHERE EXISTS (SELECT 1 FROM public.makron_daily_completions c WHERE c.user_id=v_user AND c.date=walk.d)), 0) INTO v_streak FROM walk;
  RETURN QUERY SELECT v_date, COALESCE(v_completed,false), v_streak, COALESCE(v_total,0);
END $$;
GRANT EXECUTE ON FUNCTION public.makron_daily_status() TO authenticated;

-- B. Add 5 new coin shop items (core rule)
INSERT INTO public.coin_shop_items(code, category, name, description, price, payload, consumable, is_active, sort_order)
VALUES
 ('daily_skip', 'makron', 'デイリー演習スキップ券', '今日のデイリー演習を完了扱いにする（連続記録維持）', 200, '{"applies_to":"daily"}'::jsonb, true, true, 510),
 ('daily_double', 'makron', 'デイリー報酬2倍券', '次のデイリー演習の報酬を2倍に', 150, '{"applies_to":"daily","effect":"double"}'::jsonb, true, true, 511),
 ('frame_sakura', 'cosmetic', '桜フレーム', 'アバターに桜のフレームを付ける', 300, '{"frame":"sakura"}'::jsonb, false, true, 520),
 ('title_daily_hero', 'cosmetic', '称号: デイリーの覇者', 'プロフィールに表示される称号', 500, '{"title":"デイリーの覇者"}'::jsonb, false, true, 521),
 ('coin_pouch_small', 'misc', '小さなコイン袋', '開封で30-80コイン獲得', 50, '{"min":30,"max":80}'::jsonb, true, true, 530)
ON CONFLICT (code) DO NOTHING;
