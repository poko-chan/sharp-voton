
-- habit_stamps
CREATE TABLE IF NOT EXISTS public.habit_stamps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  habit_key text not null,
  date date not null default current_date,
  created_at timestamptz not null default now(),
  unique(user_id, habit_key, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.habit_stamps TO authenticated;
GRANT ALL ON public.habit_stamps TO service_role;
ALTER TABLE public.habit_stamps ENABLE ROW LEVEL SECURITY;
CREATE POLICY hs_owner_all ON public.habit_stamps FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- daily_reflections
CREATE TABLE IF NOT EXISTS public.daily_reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  date date not null,
  summary text not null,
  created_at timestamptz not null default now(),
  unique(user_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_reflections TO authenticated;
GRANT ALL ON public.daily_reflections TO service_role;
ALTER TABLE public.daily_reflections ENABLE ROW LEVEL SECURITY;
CREATE POLICY dr_owner_all ON public.daily_reflections FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- share_tokens (parent view)
CREATE TABLE IF NOT EXISTS public.share_tokens (
  token text primary key,
  user_id uuid not null,
  label text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
GRANT SELECT ON public.share_tokens TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.share_tokens TO authenticated;
GRANT ALL ON public.share_tokens TO service_role;
ALTER TABLE public.share_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY st_owner_write ON public.share_tokens FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE POLICY st_public_read ON public.share_tokens FOR SELECT TO anon, authenticated USING (true);

-- view: study stats for share (security definer wrapper)
CREATE OR REPLACE FUNCTION public.share_study_summary(_token text)
RETURNS TABLE(date date, minutes int, subject_name text, color text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT sl.date, COALESCE(SUM(sl.duration_minutes),0)::int, s.name, s.color
  FROM public.share_tokens t
  JOIN public.study_logs sl ON sl.user_id = t.user_id
  LEFT JOIN public.subjects s ON s.id = sl.subject_id
  WHERE t.token = _token
    AND (t.expires_at IS NULL OR t.expires_at > now())
    AND sl.date >= current_date - 30
  GROUP BY sl.date, s.name, s.color
  ORDER BY sl.date DESC
$$;
GRANT EXECUTE ON FUNCTION public.share_study_summary(text) TO anon, authenticated;

-- weekday auto-apply on templates
ALTER TABLE public.today_templates ADD COLUMN IF NOT EXISTS auto_weekdays int[] NOT NULL DEFAULT '{}';
