CREATE OR REPLACE FUNCTION public.claim_daily_mission(_kind text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tpl public.daily_mission_templates%ROWTYPE;
  v_rows int := 0;
  v_date date := (now() AT TIME ZONE 'Asia/Tokyo')::date;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO v_tpl FROM public.daily_mission_templates WHERE code = _kind AND is_active LIMIT 1;
  IF v_tpl.id IS NULL THEN RAISE EXCEPTION 'unknown mission'; END IF;

  INSERT INTO public.daily_missions (user_id, date, kind, target_value, progress, completed, reward_coins)
  VALUES (v_uid, v_date, v_tpl.code, v_tpl.target, v_tpl.target, true, v_tpl.reward_coins)
  ON CONFLICT (user_id, date, kind) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('awarded', 0, 'already_claimed', true);
  END IF;

  INSERT INTO public.user_coins (user_id, balance, total_earned)
    VALUES (v_uid, v_tpl.reward_coins, v_tpl.reward_coins)
    ON CONFLICT (user_id) DO UPDATE
      SET balance = public.user_coins.balance + v_tpl.reward_coins,
          total_earned = public.user_coins.total_earned + v_tpl.reward_coins;

  INSERT INTO public.coin_transactions (user_id, amount, reason, meta)
    VALUES (v_uid, v_tpl.reward_coins, 'mission:' || v_tpl.code, jsonb_build_object('date', v_date));

  RETURN jsonb_build_object('awarded', v_tpl.reward_coins, 'already_claimed', false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_daily_mission(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_daily_mission(text) TO authenticated;