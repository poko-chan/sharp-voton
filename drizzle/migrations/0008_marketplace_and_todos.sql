CREATE TABLE public.user_installed_apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  app_id text NOT NULL,
  installed_at timestamptz NOT NULL DEFAULT now(),
  sort_order int NOT NULL DEFAULT 100,
  UNIQUE (user_id, app_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_installed_apps TO authenticated;
GRANT ALL ON public.user_installed_apps TO service_role;
ALTER TABLE public.user_installed_apps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own installed apps" ON public.user_installed_apps FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.study_todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  note text,
  subject_id uuid,
  estimated_minutes int,
  due_date date,
  priority text NOT NULL DEFAULT 'medium',
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  logged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX study_todos_user_idx ON public.study_todos (user_id, is_completed, due_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_todos TO authenticated;
GRANT ALL ON public.study_todos TO service_role;
ALTER TABLE public.study_todos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own todos" ON public.study_todos FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);