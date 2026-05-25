ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS progress_minutes integer NOT NULL DEFAULT 0;