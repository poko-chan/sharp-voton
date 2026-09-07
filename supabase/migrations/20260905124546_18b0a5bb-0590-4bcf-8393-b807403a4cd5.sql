CREATE OR REPLACE FUNCTION public.org_edu_record_result(_org uuid, _correct integer, _xp integer)
 RETURNS org_edu_streaks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r public.org_edu_streaks;
  today date := (now() AT TIME ZONE 'Asia/Tokyo')::date;
  v_total int;
  v_today int;
BEGIN
  IF NOT public.is_org_member(_org, auth.uid()) THEN
    RAISE EXCEPTION 'not a member';
  END IF;

  -- server-verified counts only; client-supplied _correct/_xp are ignored
  SELECT count(*)::int INTO v_total
  FROM public.org_edu_attempts
  WHERE organization_id = _org AND user_id = auth.uid() AND correct;

  SELECT count(*)::int INTO v_today
  FROM public.org_edu_attempts
  WHERE organization_id = _org AND user_id = auth.uid() AND correct
    AND (created_at AT TIME ZONE 'Asia/Tokyo')::date = today;

  IF v_today = 0 THEN
    SELECT * INTO r FROM public.org_edu_streaks
    WHERE organization_id = _org AND user_id = auth.uid();
    RETURN r;
  END IF;

  INSERT INTO public.org_edu_streaks (organization_id, user_id, current_streak, best_streak, total_correct, xp, last_date)
  VALUES (_org, auth.uid(), 1, 1, v_total, v_total * 10, today)
  ON CONFLICT (organization_id, user_id) DO UPDATE SET
    current_streak = CASE
      WHEN public.org_edu_streaks.last_date = today THEN public.org_edu_streaks.current_streak
      WHEN public.org_edu_streaks.last_date = today - 1 THEN public.org_edu_streaks.current_streak + 1
      ELSE 1 END,
    best_streak = GREATEST(public.org_edu_streaks.best_streak, CASE
      WHEN public.org_edu_streaks.last_date = today THEN public.org_edu_streaks.current_streak
      WHEN public.org_edu_streaks.last_date = today - 1 THEN public.org_edu_streaks.current_streak + 1
      ELSE 1 END),
    total_correct = v_total,
    xp = v_total * 10,
    last_date = today,
    updated_at = now()
  RETURNING * INTO r;
  RETURN r;
END;
$function$;