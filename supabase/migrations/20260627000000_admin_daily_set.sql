-- Admin RPCs for managing daily sets

CREATE OR REPLACE FUNCTION public.admin_set_daily_set(_date date, _question_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  INSERT INTO public.makron_daily_sets(date, question_ids)
  VALUES (_date, _question_ids)
  ON CONFLICT (date) DO UPDATE SET question_ids = EXCLUDED.question_ids;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_daily_set(date, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_daily_sets(_limit int DEFAULT 30)
RETURNS TABLE(date date, num_questions int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
    SELECT s.date, COALESCE(array_length(s.question_ids,1), 0) AS num_questions
    FROM public.makron_daily_sets s
    ORDER BY s.date DESC
    LIMIT GREATEST(1, _limit);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_list_daily_sets(int) TO authenticated;
