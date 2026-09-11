
CREATE TABLE public.org_library_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'book',
  location text,
  total_count integer NOT NULL DEFAULT 1,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_library_items TO authenticated;
GRANT ALL ON public.org_library_items TO service_role;
ALTER TABLE public.org_library_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lib_items_read" ON public.org_library_items FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "lib_items_staff" ON public.org_library_items FOR ALL TO authenticated
  USING (public.is_org_staff(organization_id, auth.uid()))
  WITH CHECK (public.is_org_staff(organization_id, auth.uid()));

CREATE TABLE public.org_library_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.org_library_items(id) ON DELETE CASCADE,
  borrower_id uuid NOT NULL,
  loaned_on date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Tokyo')::date,
  due_on date,
  returned_on date,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_library_loans TO authenticated;
GRANT ALL ON public.org_library_loans TO service_role;
ALTER TABLE public.org_library_loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lib_loans_read" ON public.org_library_loans FOR SELECT TO authenticated
  USING (borrower_id = auth.uid() OR public.is_org_staff(organization_id, auth.uid()));
CREATE POLICY "lib_loans_staff" ON public.org_library_loans FOR ALL TO authenticated
  USING (public.is_org_staff(organization_id, auth.uid()))
  WITH CHECK (public.is_org_staff(organization_id, auth.uid()));

CREATE TABLE public.org_journals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.org_groups(id) ON DELETE SET NULL,
  date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Tokyo')::date,
  weather text,
  present_count integer,
  absent_count integer,
  lessons text,
  reflection text,
  teacher_comment text,
  author_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_journals TO authenticated;
GRANT ALL ON public.org_journals TO service_role;
ALTER TABLE public.org_journals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "journal_read" ON public.org_journals FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "journal_insert" ON public.org_journals FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND author_id = auth.uid());
CREATE POLICY "journal_update_own" ON public.org_journals FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "journal_staff" ON public.org_journals FOR ALL TO authenticated
  USING (public.is_org_staff(organization_id, auth.uid()))
  WITH CHECK (public.is_org_staff(organization_id, auth.uid()));

CREATE TABLE public.org_duties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.org_groups(id) ON DELETE SET NULL,
  title text NOT NULL,
  assignee_id uuid,
  date date,
  weekday integer,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_duties TO authenticated;
GRANT ALL ON public.org_duties TO service_role;
ALTER TABLE public.org_duties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "duties_read" ON public.org_duties FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "duties_staff" ON public.org_duties FOR ALL TO authenticated
  USING (public.is_org_staff(organization_id, auth.uid()))
  WITH CHECK (public.is_org_staff(organization_id, auth.uid()));

CREATE TABLE public.org_lost_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  found_place text,
  found_on date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Tokyo')::date,
  image_url text,
  status text NOT NULL DEFAULT 'keeping',
  claimed_by uuid,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_lost_items TO authenticated;
GRANT ALL ON public.org_lost_items TO service_role;
ALTER TABLE public.org_lost_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lost_read" ON public.org_lost_items FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "lost_staff" ON public.org_lost_items FOR ALL TO authenticated
  USING (public.is_org_staff(organization_id, auth.uid()))
  WITH CHECK (public.is_org_staff(organization_id, auth.uid()));

CREATE TRIGGER trg_lib_items_upd BEFORE UPDATE ON public.org_library_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_lib_loans_upd BEFORE UPDATE ON public.org_library_loans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_journals_upd BEFORE UPDATE ON public.org_journals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_duties_upd BEFORE UPDATE ON public.org_duties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_lost_upd BEFORE UPDATE ON public.org_lost_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
