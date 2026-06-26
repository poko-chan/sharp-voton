
ALTER TABLE public.makron_daily_completions
  ADD COLUMN IF NOT EXISTS attempts int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS best_score int;
UPDATE public.makron_daily_completions SET best_score = score WHERE best_score IS NULL;

DROP POLICY IF EXISTS "own daily completions update" ON public.makron_daily_completions;
CREATE POLICY "own daily completions update" ON public.makron_daily_completions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.makron_start_daily_session()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_date date := public.jst_today();
  v_ids uuid[];
  v_session uuid;
  v_existing record;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO v_existing FROM public.makron_daily_completions
    WHERE user_id = v_user AND date = v_date;
  IF FOUND THEN
    IF COALESCE(v_existing.best_score,0) >= COALESCE(v_existing.total,0) AND COALESCE(v_existing.total,0) > 0 THEN
      RAISE EXCEPTION 'today_completed';
    ELSIF v_existing.attempts >= 2 THEN
      RAISE EXCEPTION 'today_retry_used';
    END IF;
  END IF;
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

CREATE OR REPLACE FUNCTION public.makron_finalize_daily(_session_id uuid)
RETURNS TABLE(total_score int, total_points int, xp_awarded int, coins_awarded int, bonus_xp int, bonus_coins int, streak int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_kind text; v_date date; v_score int; v_total int;
  v_xp int; v_coins int; v_bxp int := 0; v_bcoins int := 0;
  v_streak int := 0;
  v_existing record;
  r record;
BEGIN
  SELECT kind, daily_date INTO v_kind, v_date FROM public.makron_sessions WHERE id = _session_id AND user_id = v_user;
  IF v_kind IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  SELECT * INTO r FROM public.finalize_makron_session(_session_id);
  v_score := r.total_score; v_total := r.total_points; v_xp := r.xp_awarded; v_coins := r.coins_awarded;
  IF v_kind = 'daily' THEN
    SELECT * INTO v_existing FROM public.makron_daily_completions WHERE user_id=v_user AND date=v_date;
    IF NOT FOUND THEN
      v_bxp := 50; v_bcoins := 20;
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
      INSERT INTO public.makron_daily_completions(user_id, date, session_id, score, total, attempts, best_score)
        VALUES (v_user, v_date, _session_id, v_score, v_total, 1, v_score);
    ELSE
      UPDATE public.makron_daily_completions
        SET attempts = attempts + 1,
            session_id = _session_id,
            score = v_score,
            best_score = GREATEST(COALESCE(best_score, 0), v_score),
            total = GREATEST(total, v_total),
            completed_at = now()
        WHERE user_id = v_user AND date = v_date;
    END IF;
  END IF;
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

DROP FUNCTION IF EXISTS public.makron_daily_status();
CREATE FUNCTION public.makron_daily_status()
RETURNS TABLE(date date, completed boolean, streak int, total_questions int, best_score int, attempts int, can_retry boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_date date := public.jst_today();
  v_total int := 0;
  v_streak int := 0;
  v_existing record;
  v_completed boolean := false;
  v_can_retry boolean := false;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT COALESCE(array_length(question_ids,1),0) INTO v_total FROM public.makron_daily_sets WHERE date=v_date;
  SELECT * INTO v_existing FROM public.makron_daily_completions WHERE user_id=v_user AND date=v_date;
  IF FOUND THEN
    IF COALESCE(v_existing.best_score,0) >= COALESCE(v_existing.total,0) AND COALESCE(v_existing.total,0) > 0 THEN
      v_completed := true;
    ELSIF v_existing.attempts < 2 THEN
      v_can_retry := true;
    ELSE
      v_completed := true;
    END IF;
  END IF;
  WITH RECURSIVE walk AS (
    SELECT v_date AS d, 0 AS n
    UNION ALL
    SELECT (w.d - 1), w.n + 1 FROM walk w
    WHERE EXISTS (SELECT 1 FROM public.makron_daily_completions c WHERE c.user_id=v_user AND c.date=w.d)
      AND w.n < 365
  )
  SELECT COALESCE(MAX(n+1) FILTER (WHERE EXISTS (SELECT 1 FROM public.makron_daily_completions c WHERE c.user_id=v_user AND c.date=walk.d)), 0) INTO v_streak FROM walk;
  RETURN QUERY SELECT v_date, v_completed, v_streak, COALESCE(v_total,0),
                       COALESCE(v_existing.best_score, 0),
                       COALESCE(v_existing.attempts, 0),
                       v_can_retry;
END $$;
GRANT EXECUTE ON FUNCTION public.makron_daily_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_daily_set(_date date, _question_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  INSERT INTO public.makron_daily_sets(date, question_ids)
    VALUES (_date, COALESCE(_question_ids, ARRAY[]::uuid[]))
    ON CONFLICT (date) DO UPDATE SET question_ids = EXCLUDED.question_ids;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_set_daily_set(date, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_daily_sets(_limit int DEFAULT 30)
RETURNS TABLE(date date, question_ids uuid[], num_questions int)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT date, question_ids, COALESCE(array_length(question_ids,1),0)
  FROM public.makron_daily_sets
  ORDER BY date DESC
  LIMIT GREATEST(1, COALESCE(_limit, 30))
$$;
GRANT EXECUTE ON FUNCTION public.admin_list_daily_sets(int) TO authenticated;

-- Add daily shop items (per memory rule)
INSERT INTO public.coin_shop_items(code, category, name, description, price, payload, consumable, is_active, sort_order)
VALUES
 ('miku_companion', 'cosmetic', '初音ミクのピクセル仲間', '画面上を歩き回るピクセルアートを解放', 400, '{"feature":"miku"}'::jsonb, false, true, 540),
 ('custom_music_slot', 'cosmetic', 'タイマー音楽スロット拡張', 'お気に入りの音楽URLをタイマーで再生', 200, '{"feature":"timer_music"}'::jsonb, false, true, 541),
 ('barcode_pro', 'misc', 'バーコードスキャンPro', '高速読み取りの体感ブースト（演出）', 100, '{"feature":"barcode"}'::jsonb, false, true, 542),
 ('material_picker_xl', 'misc', '大画面教材ピッカー', '記録画面の教材ピッカーを大型化（既定で有効）', 80, '{"feature":"material_picker"}'::jsonb, false, true, 543),
 ('daily_retry_token', 'makron', 'デイリー再挑戦トークン', '今日の再挑戦回数を1回追加（自動使用）', 250, '{"applies_to":"daily","effect":"extra_attempt"}'::jsonb, true, true, 544)
ON CONFLICT (code) DO NOTHING;
