
-- Add theme color & notification prefs to user_prefs
ALTER TABLE public.user_prefs 
  ADD COLUMN IF NOT EXISTS theme_color text DEFAULT '#3B82F6',
  ADD COLUMN IF NOT EXISTS notif_settings jsonb DEFAULT '{}'::jsonb;

-- Add tag to study_logs
ALTER TABLE public.study_logs ADD COLUMN IF NOT EXISTS tag text;

-- Missions (daily)
CREATE TABLE IF NOT EXISTS public.daily_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT current_date,
  kind text NOT NULL,
  target_value int NOT NULL DEFAULT 1,
  progress int NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  reward_coins int NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, date, kind)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_missions TO authenticated;
GRANT ALL ON public.daily_missions TO service_role;
ALTER TABLE public.daily_missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own missions" ON public.daily_missions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Quiz battles
CREATE TABLE IF NOT EXISTS public.quiz_battles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id uuid NOT NULL,
  opponent_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  challenger_score int NOT NULL DEFAULT 0,
  opponent_score int NOT NULL DEFAULT 0,
  winner_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_battles TO authenticated;
GRANT ALL ON public.quiz_battles TO service_role;
ALTER TABLE public.quiz_battles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "battle participants view" ON public.quiz_battles FOR SELECT USING (auth.uid() IN (challenger_id, opponent_id));
CREATE POLICY "create own battle" ON public.quiz_battles FOR INSERT WITH CHECK (auth.uid() = challenger_id);
CREATE POLICY "update participants" ON public.quiz_battles FOR UPDATE USING (auth.uid() IN (challenger_id, opponent_id));

-- Leaderboard view
CREATE OR REPLACE FUNCTION public.get_leaderboard(_limit int DEFAULT 10)
RETURNS TABLE(user_id uuid, display_name text, avatar_url text, total_minutes int, streak_days int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.display_name, p.avatar_url,
    COALESCE((SELECT SUM(duration_minutes) FROM public.study_logs s WHERE s.user_id = p.id), 0)::int,
    COALESCE((SELECT COUNT(DISTINCT date) FROM public.study_logs s WHERE s.user_id = p.id AND s.date >= current_date - 30), 0)::int
  FROM public.profiles p
  WHERE p.account_kind = 'child'
  ORDER BY 4 DESC
  LIMIT _limit
$$;
