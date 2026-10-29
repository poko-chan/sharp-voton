ALTER TABLE public.study_logs
  ADD COLUMN IF NOT EXISTS understanding text CHECK (understanding IN ('good','ok','review')),
  ADD COLUMN IF NOT EXISTS focus_level smallint CHECK (focus_level BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS range_text text,
  ADD COLUMN IF NOT EXISTS next_step text,
  ADD COLUMN IF NOT EXISTS reflection_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
CREATE INDEX IF NOT EXISTS study_logs_user_review_idx ON public.study_logs (user_id, understanding) WHERE understanding = 'review';