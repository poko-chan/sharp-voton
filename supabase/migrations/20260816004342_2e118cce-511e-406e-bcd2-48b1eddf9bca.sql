
-- 1. 組織プロフィール項目定義
CREATE TABLE public.org_profile_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  type text NOT NULL DEFAULT 'text',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  required boolean NOT NULL DEFAULT false,
  staff_only boolean NOT NULL DEFAULT true,
  yearly boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_profile_fields TO authenticated;
GRANT ALL ON public.org_profile_fields TO service_role;
ALTER TABLE public.org_profile_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fields readable by members" ON public.org_profile_fields FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "fields managed by org admin" ON public.org_profile_fields FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- 2. 年度別プロフィール値
CREATE TABLE public.org_profile_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  year text NOT NULL,
  values jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id, year)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_profile_years TO authenticated;
GRANT ALL ON public.org_profile_years TO service_role;
ALTER TABLE public.org_profile_years ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profile years readable by members" ON public.org_profile_years FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profile years managed by staff" ON public.org_profile_years FOR ALL TO authenticated
  USING (public.is_org_staff(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_org_staff(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS current_year text;

-- 3. Makron for education
CREATE TABLE public.org_edu_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#7B6CFF',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.org_edu_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.org_edu_subjects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  level integer NOT NULL DEFAULT 1,
  audience jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.org_edu_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.org_edu_units(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'choice',
  body text NOT NULL,
  choices jsonb NOT NULL DEFAULT '[]'::jsonb,
  answer text NOT NULL DEFAULT '',
  explanation text,
  hint_text text,
  audience jsonb NOT NULL DEFAULT '{}'::jsonb,
  level integer NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.org_edu_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.org_edu_units(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.org_edu_questions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  correct boolean NOT NULL DEFAULT false,
  user_answer text,
  ai_review text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.org_edu_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  current_streak integer NOT NULL DEFAULT 0,
  best_streak integer NOT NULL DEFAULT 0,
  total_correct integer NOT NULL DEFAULT 0,
  xp integer NOT NULL DEFAULT 0,
  last_date date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_edu_subjects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_edu_units TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_edu_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_edu_attempts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_edu_streaks TO authenticated;
GRANT ALL ON public.org_edu_subjects, public.org_edu_units, public.org_edu_questions, public.org_edu_attempts, public.org_edu_streaks TO service_role;

ALTER TABLE public.org_edu_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_edu_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_edu_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_edu_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_edu_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "edu subjects read" ON public.org_edu_subjects FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "edu subjects manage" ON public.org_edu_subjects FOR ALL TO authenticated
  USING (public.is_org_staff(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_org_staff(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "edu units read" ON public.org_edu_units FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "edu units manage" ON public.org_edu_units FOR ALL TO authenticated
  USING (public.is_org_staff(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_org_staff(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "edu questions read" ON public.org_edu_questions FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "edu questions manage" ON public.org_edu_questions FOR ALL TO authenticated
  USING (public.is_org_staff(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_org_staff(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "edu attempts own" ON public.org_edu_attempts FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "edu attempts staff read" ON public.org_edu_attempts FOR SELECT TO authenticated
  USING (public.is_org_staff(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "edu streaks own" ON public.org_edu_streaks FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "edu streaks staff read" ON public.org_edu_streaks FOR SELECT TO authenticated
  USING (public.is_org_staff(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_org_profile_fields_updated_at BEFORE UPDATE ON public.org_profile_fields
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_org_profile_years_updated_at BEFORE UPDATE ON public.org_profile_years
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_org_edu_subjects_updated_at BEFORE UPDATE ON public.org_edu_subjects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_org_edu_units_updated_at BEFORE UPDATE ON public.org_edu_units
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_org_edu_questions_updated_at BEFORE UPDATE ON public.org_edu_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. 学習ストリーク更新 RPC
CREATE OR REPLACE FUNCTION public.org_edu_record_result(_org uuid, _correct integer, _xp integer)
RETURNS public.org_edu_streaks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.org_edu_streaks;
  today date := (now() AT TIME ZONE 'Asia/Tokyo')::date;
BEGIN
  IF NOT public.is_org_member(_org, auth.uid()) THEN
    RAISE EXCEPTION 'not a member';
  END IF;
  INSERT INTO public.org_edu_streaks (organization_id, user_id, current_streak, best_streak, total_correct, xp, last_date)
  VALUES (_org, auth.uid(), 1, 1, GREATEST(_correct, 0), GREATEST(_xp, 0), today)
  ON CONFLICT (organization_id, user_id) DO UPDATE SET
    current_streak = CASE
      WHEN public.org_edu_streaks.last_date = today THEN public.org_edu_streaks.current_streak
      WHEN public.org_edu_streaks.last_date = today - 1 THEN public.org_edu_streaks.current_streak + 1
      ELSE 1 END,
    best_streak = GREATEST(public.org_edu_streaks.best_streak, CASE
      WHEN public.org_edu_streaks.last_date = today THEN public.org_edu_streaks.current_streak
      WHEN public.org_edu_streaks.last_date = today - 1 THEN public.org_edu_streaks.current_streak + 1
      ELSE 1 END),
    total_correct = public.org_edu_streaks.total_correct + GREATEST(_correct, 0),
    xp = public.org_edu_streaks.xp + GREATEST(_xp, 0),
    last_date = today,
    updated_at = now()
  RETURNING * INTO r;
  RETURN r;
END;
$$;
