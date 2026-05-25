CREATE TABLE public.grading_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  question_id uuid NOT NULL,
  user_answer text NOT NULL,
  score integer NOT NULL,
  correct boolean NOT NULL,
  feedback text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.grading_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY gh_owner_all ON public.grading_history
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_gh_question ON public.grading_history(question_id, created_at DESC);
CREATE INDEX idx_gh_user ON public.grading_history(user_id, created_at DESC);