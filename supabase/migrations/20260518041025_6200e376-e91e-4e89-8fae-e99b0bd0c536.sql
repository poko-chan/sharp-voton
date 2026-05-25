CREATE OR REPLACE FUNCTION public.get_user_study_stats(_user_ids uuid[])
RETURNS TABLE(user_id uuid, total_minutes integer, last_date date)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.user_id,
         COALESCE(SUM(s.duration_minutes), 0)::int AS total_minutes,
         MAX(s.date) AS last_date
  FROM public.study_logs s
  WHERE s.user_id = ANY(_user_ids)
  GROUP BY s.user_id
$$;

GRANT EXECUTE ON FUNCTION public.get_user_study_stats(uuid[]) TO authenticated;