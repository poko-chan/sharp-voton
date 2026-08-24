-- Restore missing GRANTs for exam feature tables so adding subjects/exams works
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_series TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_subjects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_todos TO authenticated;
GRANT ALL ON public.exam_series TO service_role;
GRANT ALL ON public.exams TO service_role;
GRANT ALL ON public.exam_subjects TO service_role;
GRANT ALL ON public.exam_todos TO service_role;

GRANT SELECT ON public.daily_mission_templates TO authenticated;
GRANT ALL ON public.daily_mission_templates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_missions TO authenticated;
GRANT ALL ON public.daily_missions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_coins TO authenticated;
GRANT ALL ON public.user_coins TO service_role;
GRANT SELECT, INSERT ON public.coin_transactions TO authenticated;
GRANT ALL ON public.coin_transactions TO service_role;

-- Remove coin reward from exam todo completion
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

-- Idempotent daily-mission claim (prevents double reward from button spam)
CREATE OR REPLACE FUNCTION public.claim_daily_mission(
  _kind TEXT, _date DATE, _target INT, _reward_coins INT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_rows INT := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  INSERT INTO public.daily_missions (user_id, date, kind, target_value, progress, completed, reward_coins)
  VALUES (v_uid, _date, _kind, _target, _target, true, _reward_coins)
  ON CONFLICT (user_id, date, kind) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
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

REVOKE ALL ON FUNCTION public.claim_daily_mission(TEXT, DATE, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_daily_mission(TEXT, DATE, INT, INT) TO authenticated;

-- Sticky notes: front/back ordering
ALTER TABLE public.sticky_notes ADD COLUMN IF NOT EXISTS z_index integer NOT NULL DEFAULT 0;
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) AS rn
  FROM public.sticky_notes
)
UPDATE public.sticky_notes sn SET z_index = ranked.rn FROM ranked WHERE ranked.id = sn.id AND sn.z_index = 0;