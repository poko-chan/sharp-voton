CREATE TABLE public.org_student_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  school_year int NOT NULL,
  grade text,
  class_name text,
  student_number text,
  note text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id, school_year)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_student_records TO authenticated;
GRANT ALL ON public.org_student_records TO service_role;
ALTER TABLE public.org_student_records ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.org_is_staff(_org uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid, 'admin') OR EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org AND user_id = _uid AND suspended = false
      AND role IN ('owner','admin','teacher'))
$$;
GRANT EXECUTE ON FUNCTION public.org_is_staff(uuid, uuid) TO authenticated;

CREATE POLICY "student records read own or staff" ON public.org_student_records
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.org_is_staff(organization_id, auth.uid()));
CREATE POLICY "student records staff insert" ON public.org_student_records
  FOR INSERT TO authenticated WITH CHECK (public.org_is_staff(organization_id, auth.uid()));
CREATE POLICY "student records staff update" ON public.org_student_records
  FOR UPDATE TO authenticated USING (public.org_is_staff(organization_id, auth.uid()))
  WITH CHECK (public.org_is_staff(organization_id, auth.uid()));
CREATE POLICY "student records staff delete" ON public.org_student_records
  FOR DELETE TO authenticated USING (public.org_is_staff(organization_id, auth.uid()));

CREATE INDEX org_student_records_org_year_idx ON public.org_student_records(organization_id, school_year);