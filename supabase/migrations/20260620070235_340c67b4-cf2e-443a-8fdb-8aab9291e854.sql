
-- 1) OCR 形式を許可
ALTER TABLE public.makron_questions DROP CONSTRAINT IF EXISTS makron_questions_type_check;
ALTER TABLE public.makron_questions ADD CONSTRAINT makron_questions_type_check
  CHECK (type = ANY (ARRAY['single','multi','text','written','file','ocr']));

-- 2) 開始時の演習可否チェック + attempts インクリメント
CREATE OR REPLACE FUNCTION public.makron_start_pack_session(_pack_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_pack public.makron_packs;
  v_att  public.makron_pack_attempts;
  v_session uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO v_pack FROM public.makron_packs WHERE id = _pack_id;
  IF v_pack.id IS NULL THEN RAISE EXCEPTION 'pack not found'; END IF;
  IF v_pack.status <> 'approved' AND v_pack.created_by <> v_user AND NOT public.has_role(v_user,'admin') THEN
    RAISE EXCEPTION 'pack not available';
  END IF;

  SELECT * INTO v_att FROM public.makron_pack_attempts WHERE user_id=v_user AND pack_id=_pack_id FOR UPDATE;
  IF v_att.user_id IS NULL THEN
    INSERT INTO public.makron_pack_attempts(user_id, pack_id, attempts_count, last_attempt_at)
      VALUES (v_user, _pack_id, 1, now()) RETURNING * INTO v_att;
  ELSE
    IF v_pack.max_attempts IS NOT NULL AND v_att.attempts_count >= v_pack.max_attempts THEN
      RAISE EXCEPTION 'このパックの演習回数上限に達しています';
    END IF;
    UPDATE public.makron_pack_attempts
       SET attempts_count = attempts_count + 1, last_attempt_at = now()
     WHERE user_id=v_user AND pack_id=_pack_id RETURNING * INTO v_att;
  END IF;

  INSERT INTO public.makron_sessions(user_id, unit_id, pack_id)
    VALUES (v_user, v_pack.unit_id, _pack_id)
    RETURNING id INTO v_session;
  RETURN v_session;
END $$;

-- 3) finalize_makron_session を更新：公式パックのみ報酬。パック単価・上限を尊重
CREATE OR REPLACE FUNCTION public.finalize_makron_session(_session_id uuid)
 RETURNS TABLE(total_score integer, total_points integer, xp_awarded integer, coins_awarded integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid; v_pack_id uuid; v_pack public.makron_packs;
  v_total_points int := 0; v_score int := 0;
  v_correct int := 0; v_wrong int := 0;
  v_xp int := 0; v_coins int := 0;
  v_rate_coin int := 2; v_rate_xp int := 10;
  v_cap int := 200; v_today_earned int := 0; v_today_date date;
  v_att public.makron_pack_attempts; v_is_official boolean := false;
BEGIN
  SELECT user_id, pack_id INTO v_user, v_pack_id FROM public.makron_sessions WHERE id = _session_id;
  IF v_user IS NULL OR v_user <> auth.uid() THEN RAISE EXCEPTION 'not authorized'; END IF;

  IF v_pack_id IS NOT NULL THEN
    SELECT * INTO v_pack FROM public.makron_packs WHERE id = v_pack_id;
    v_is_official := COALESCE(v_pack.is_official, false);
    v_rate_xp   := COALESCE(v_pack.xp_per_question, 10);
    v_rate_coin := COALESCE(v_pack.coin_per_question, 2);
  ELSE
    SELECT COALESCE(makron_coin_per_correct,2), COALESCE(makron_xp_per_correct,10)
      INTO v_rate_coin, v_rate_xp FROM public.app_settings WHERE id=1;
    v_is_official := true; -- legacy
  END IF;

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

  -- 公式パックのみ報酬
  IF v_is_official THEN
    v_xp := v_correct * v_rate_xp + v_wrong * 2;
    v_coins := v_correct * v_rate_coin;

    -- パック単位の上限制御
    IF v_pack_id IS NOT NULL THEN
      SELECT * INTO v_att FROM public.makron_pack_attempts
        WHERE user_id=v_user AND pack_id=v_pack_id FOR UPDATE;
      IF v_pack.reward_attempts_cap IS NOT NULL
         AND COALESCE(v_att.rewards_granted_count,0) >= v_pack.reward_attempts_cap THEN
        v_xp := 0; v_coins := 0;
      END IF;
      IF v_pack.xp_cap_per_user IS NOT NULL AND v_xp > 0 THEN
        v_xp := LEAST(v_xp, GREATEST(0, v_pack.xp_cap_per_user - COALESCE(v_att.xp_earned_total,0)));
      END IF;
      IF v_pack.coin_cap_per_user IS NOT NULL AND v_coins > 0 THEN
        v_coins := LEAST(v_coins, GREATEST(0, v_pack.coin_cap_per_user - COALESCE(v_att.coins_earned_total,0)));
      END IF;
    END IF;

    -- 日次コインキャップ
    SELECT daily_earned_date, daily_earned INTO v_today_date, v_today_earned FROM public.user_coins WHERE user_id=v_user;
    IF v_today_date IS DISTINCT FROM current_date THEN v_today_earned := 0; END IF;
    IF v_today_earned + v_coins > v_cap THEN v_coins := GREATEST(0, v_cap - v_today_earned); END IF;
  ELSE
    v_xp := 0; v_coins := 0;
  END IF;

  UPDATE public.makron_sessions
    SET finished_at = COALESCE(finished_at, now()),
        total_score = v_score, total_points = v_total_points,
        xp_awarded = v_xp, coins_awarded = v_coins,
        passed = CASE WHEN v_pack.pass_score IS NOT NULL THEN v_score >= v_pack.pass_score ELSE NULL END
  WHERE id = _session_id;

  IF v_xp > 0 THEN
    INSERT INTO public.makron_xp(user_id, xp, level)
      VALUES (v_user, v_xp, GREATEST(1, floor(sqrt(v_xp::numeric/50))::int + 1))
      ON CONFLICT (user_id) DO UPDATE
      SET xp = public.makron_xp.xp + EXCLUDED.xp,
          level = GREATEST(1, floor(sqrt((public.makron_xp.xp + EXCLUDED.xp)::numeric/50))::int + 1),
          updated_at = now();
  END IF;

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

  IF v_pack_id IS NOT NULL AND (v_xp > 0 OR v_coins > 0) THEN
    UPDATE public.makron_pack_attempts SET
      rewards_granted_count = rewards_granted_count + 1,
      xp_earned_total = xp_earned_total + v_xp,
      coins_earned_total = coins_earned_total + v_coins
    WHERE user_id=v_user AND pack_id=v_pack_id;
  END IF;

  RETURN QUERY SELECT v_score, v_total_points, v_xp, v_coins;
END $$;
