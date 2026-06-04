
-- Registered activities (lessons / 習い事 / custom)
CREATE TABLE public.today_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#60a5fa',
  category text NOT NULL DEFAULT 'lesson', -- lesson/club/custom
  default_duration_min int NOT NULL DEFAULT 60,
  location text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.today_activities TO authenticated;
GRANT ALL ON public.today_activities TO service_role;
ALTER TABLE public.today_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY ta_owner_all ON public.today_activities FOR ALL
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(),'admin'));

-- Today timeline entries (one row per block in a day)
CREATE TABLE public.today_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  category text NOT NULL, -- school/meal/activity/free/sleep/bath/travel/event/study/custom
  label text,
  color text NOT NULL DEFAULT '#94a3b8',
  start_time time NOT NULL,
  end_time time NOT NULL,
  activity_id uuid REFERENCES public.today_activities(id) ON DELETE SET NULL,
  subject_id uuid,
  notes text,
  travel_before_min int NOT NULL DEFAULT 0,
  travel_after_min int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.today_entries TO authenticated;
GRANT ALL ON public.today_entries TO service_role;
ALTER TABLE public.today_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY te2_owner_all ON public.today_entries FOR ALL
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE INDEX today_entries_user_date_idx ON public.today_entries(user_id, date);

-- Templates (school / weekly / custom)
CREATE TABLE public.today_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'school', -- school/weekly/custom
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.today_templates TO authenticated;
GRANT ALL ON public.today_templates TO service_role;
ALTER TABLE public.today_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY tt2_owner_or_shared_select ON public.today_templates FOR SELECT
  USING (auth.uid() = user_id OR shared = true OR has_role(auth.uid(),'admin'));
CREATE POLICY tt2_owner_write ON public.today_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY tt2_owner_update ON public.today_templates FOR UPDATE
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE POLICY tt2_owner_delete ON public.today_templates FOR DELETE
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));

CREATE TRIGGER tg_today_activities_updated BEFORE UPDATE ON public.today_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tg_today_entries_updated BEFORE UPDATE ON public.today_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tg_today_templates_updated BEFORE UPDATE ON public.today_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
