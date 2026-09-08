-- 共通 updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

-- 1. 出欠
CREATE TABLE public.org_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  date date NOT NULL,
  period int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'present',
  reason text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id, date, period)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_attendance TO authenticated;
GRANT ALL ON public.org_attendance TO service_role;
ALTER TABLE public.org_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY att_select ON public.org_attendance FOR SELECT TO authenticated
  USING (public.is_org_staff(organization_id, auth.uid()) OR user_id = auth.uid());
CREATE POLICY att_write ON public.org_attendance FOR ALL TO authenticated
  USING (public.is_org_staff(organization_id, auth.uid())) WITH CHECK (public.is_org_staff(organization_id, auth.uid()));
CREATE TRIGGER trg_att_upd BEFORE UPDATE ON public.org_attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. 欠席連絡
CREATE TABLE public.org_absence_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  date date NOT NULL,
  kind text NOT NULL DEFAULT 'absent',
  reason text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_absence_requests TO authenticated;
GRANT ALL ON public.org_absence_requests TO service_role;
ALTER TABLE public.org_absence_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY abs_select ON public.org_absence_requests FOR SELECT TO authenticated
  USING (public.is_org_staff(organization_id, auth.uid()) OR user_id = auth.uid());
CREATE POLICY abs_insert ON public.org_absence_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_org_member(organization_id, auth.uid()));
CREATE POLICY abs_update ON public.org_absence_requests FOR UPDATE TO authenticated
  USING (public.is_org_staff(organization_id, auth.uid())) WITH CHECK (public.is_org_staff(organization_id, auth.uid()));
CREATE POLICY abs_delete ON public.org_absence_requests FOR DELETE TO authenticated
  USING (public.is_org_staff(organization_id, auth.uid()) OR (user_id = auth.uid() AND status = 'pending'));
CREATE TRIGGER trg_abs_upd BEFORE UPDATE ON public.org_absence_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. 時間割
CREATE TABLE public.org_timetable (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  group_id uuid,
  day_of_week int NOT NULL,
  period int NOT NULL,
  subject text NOT NULL,
  room text,
  teacher_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_timetable TO authenticated;
GRANT ALL ON public.org_timetable TO service_role;
ALTER TABLE public.org_timetable ENABLE ROW LEVEL SECURITY;
CREATE POLICY tt_select ON public.org_timetable FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY tt_write ON public.org_timetable FOR ALL TO authenticated
  USING (public.is_org_staff(organization_id, auth.uid())) WITH CHECK (public.is_org_staff(organization_id, auth.uid()));
CREATE TRIGGER trg_tt_upd BEFORE UPDATE ON public.org_timetable
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. 成績
CREATE TABLE public.org_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  student_id uuid NOT NULL,
  term text NOT NULL,
  subject text NOT NULL,
  score numeric,
  grade text,
  comment text,
  published boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_grades TO authenticated;
GRANT ALL ON public.org_grades TO service_role;
ALTER TABLE public.org_grades ENABLE ROW LEVEL SECURITY;
CREATE POLICY grd_select ON public.org_grades FOR SELECT TO authenticated
  USING (public.is_org_staff(organization_id, auth.uid()) OR (student_id = auth.uid() AND published));
CREATE POLICY grd_write ON public.org_grades FOR ALL TO authenticated
  USING (public.is_org_staff(organization_id, auth.uid())) WITH CHECK (public.is_org_staff(organization_id, auth.uid()));
CREATE TRIGGER trg_grd_upd BEFORE UPDATE ON public.org_grades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. 面談
CREATE TABLE public.org_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  student_id uuid NOT NULL,
  staff_id uuid,
  start_at timestamptz NOT NULL,
  duration_min int NOT NULL DEFAULT 20,
  place text,
  kind text NOT NULL DEFAULT 'student',
  status text NOT NULL DEFAULT 'scheduled',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_meetings TO authenticated;
GRANT ALL ON public.org_meetings TO service_role;
ALTER TABLE public.org_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY mtg_select ON public.org_meetings FOR SELECT TO authenticated
  USING (public.is_org_staff(organization_id, auth.uid()) OR student_id = auth.uid());
CREATE POLICY mtg_write ON public.org_meetings FOR ALL TO authenticated
  USING (public.is_org_staff(organization_id, auth.uid())) WITH CHECK (public.is_org_staff(organization_id, auth.uid()));
CREATE TRIGGER trg_mtg_upd BEFORE UPDATE ON public.org_meetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. 保健室
CREATE TABLE public.org_health_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  student_id uuid NOT NULL,
  visited_at timestamptz NOT NULL DEFAULT now(),
  symptom text,
  action text,
  temperature numeric,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_health_visits TO authenticated;
GRANT ALL ON public.org_health_visits TO service_role;
ALTER TABLE public.org_health_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY hv_select ON public.org_health_visits FOR SELECT TO authenticated
  USING (public.is_org_staff(organization_id, auth.uid()) OR student_id = auth.uid());
CREATE POLICY hv_write ON public.org_health_visits FOR ALL TO authenticated
  USING (public.is_org_staff(organization_id, auth.uid())) WITH CHECK (public.is_org_staff(organization_id, auth.uid()));
CREATE TRIGGER trg_hv_upd BEFORE UPDATE ON public.org_health_visits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. 指導記録（先生のみ）
CREATE TABLE public.org_guidance_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  student_id uuid NOT NULL,
  category text NOT NULL DEFAULT 'general',
  body text NOT NULL,
  author_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_guidance_notes TO authenticated;
GRANT ALL ON public.org_guidance_notes TO service_role;
ALTER TABLE public.org_guidance_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY gn_all ON public.org_guidance_notes FOR ALL TO authenticated
  USING (public.is_org_staff(organization_id, auth.uid())) WITH CHECK (public.is_org_staff(organization_id, auth.uid()));
CREATE TRIGGER trg_gn_upd BEFORE UPDATE ON public.org_guidance_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. 相談・通報
CREATE TABLE public.org_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  reporter_id uuid,
  category text NOT NULL DEFAULT 'other',
  body text NOT NULL,
  anonymous boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'open',
  handled_by uuid,
  staff_reply text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_incidents TO authenticated;
GRANT ALL ON public.org_incidents TO service_role;
ALTER TABLE public.org_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY inc_select ON public.org_incidents FOR SELECT TO authenticated
  USING (public.is_org_staff(organization_id, auth.uid()) OR (reporter_id = auth.uid() AND NOT anonymous));
CREATE POLICY inc_insert ON public.org_incidents FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND (reporter_id = auth.uid() OR (anonymous AND reporter_id IS NULL)));
CREATE POLICY inc_update ON public.org_incidents FOR UPDATE TO authenticated
  USING (public.is_org_staff(organization_id, auth.uid())) WITH CHECK (public.is_org_staff(organization_id, auth.uid()));
CREATE TRIGGER trg_inc_upd BEFORE UPDATE ON public.org_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. 見守りアラート
CREATE TABLE public.org_watch_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  student_id uuid NOT NULL,
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  detail text,
  resolved boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_watch_flags TO authenticated;
GRANT ALL ON public.org_watch_flags TO service_role;
ALTER TABLE public.org_watch_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY wf_all ON public.org_watch_flags FOR ALL TO authenticated
  USING (public.is_org_staff(organization_id, auth.uid())) WITH CHECK (public.is_org_staff(organization_id, auth.uid()));
CREATE TRIGGER trg_wf_upd BEFORE UPDATE ON public.org_watch_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_att_org_date ON public.org_attendance (organization_id, date);
CREATE INDEX idx_grd_org_student ON public.org_grades (organization_id, student_id);
CREATE INDEX idx_mtg_org_start ON public.org_meetings (organization_id, start_at);
