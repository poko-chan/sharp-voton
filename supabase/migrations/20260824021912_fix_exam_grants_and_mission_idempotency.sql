-- 1) Restore missing GRANTs for exam feature tables so INSERT/UPDATE works for authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_series TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_subjects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_todos TO authenticated;
GRANT ALL ON public.exam_series TO service_role;
GRANT ALL ON public.exams TO service_role;
GRANT ALL ON public.exam_subjects TO service_role;
GRANT ALL ON public.exam_todos TO service_role;

-- Also restore missing GRANTs for mission/coin tables (needed for daily missions + coin claim flow)
GRANT SELECT ON public.daily_mission_templates TO authenticated;
GRANT ALL ON public.daily_mission_templates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_missions TO authenticated;
GRANT ALL ON public.daily_missions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_coins TO authenticated;
GRANT ALL ON public.user_coins TO service_role;
GRANT SELECT, INSERT ON public.coin_transactions TO authenticated;
GRANT ALL ON public.coin_transactions TO service_role;

-- 2) Remove coin reward from exam todo completion (feature deprecated)
CREATE OR REPLACE FUNCTION public.complete_exam_todo(_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_todo RECORD;
BEGIN
  SELECT * INTO v_todo FROM public.exam_todos WHERE id = _id AND user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'todo not found'; END IF;
  IF NOT v_todo.done THEN
    UPDATE public.exam_todos SET done = true, done_at = now() WHERE id = _id;
  ELSE
    UPDATE public.exam_todos SET done = false, done_at = NULL WHERE id = _id;
  END IF;
  RETURN jsonb_build_object('awarded', 0);
END;$$;

-- 3) Idempotent daily-mission claim (server-side, prevents double reward from button spam)
CREATE OR REPLACE FUNCTION public.claim_daily_mission(
  _kind TEXT,
  _date DATE,
  _target INT,
  _reward_coins INT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_inserted BOOLEAN := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Atomic: only one row per (user, date, kind) can ever be inserted, thanks to the
  -- unique constraint daily_missions_user_id_date_kind_key. Concurrent/duplicate
  -- clicks will hit ON CONFLICT DO NOTHING and award nothing on the 2nd+ call.
  INSERT INTO public.daily_missions (user_id, date, kind, target_value, progress, completed, reward_coins)
  VALUES (v_uid, _date, _kind, _target, _target, true, _reward_coins)
  ON CONFLICT (user_id, date, kind) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF NOT v_inserted THEN
    RETURN jsonb_build_object('awarded', 0, 'already_claimed', true);
  END IF;

  INSERT INTO public.user_coins (user_id, balance, total_earned)
    VALUES (v_uid, _reward_coins, _reward_coins)
    ON CONFLICT (user_id) DO UPDATE
      SET balance = public.user_coins.balance + _reward_coins,
          total_earned = public.user_coins.total_earned + _reward_coins;

  INSERT INTO public.coin_transactions (user_id, amount, reason, metadata)
    VALUES (v_uid, _reward_coins, 'mission:' || _kind, jsonb_build_object('date', _date));

  RETURN jsonb_build_object('awarded', _reward_coins, 'already_claimed', false);
END;$$;

GRANT EXECUTE ON FUNCTION public.claim_daily_mission(TEXT, DATE, INT, INT) TO authenticated;
