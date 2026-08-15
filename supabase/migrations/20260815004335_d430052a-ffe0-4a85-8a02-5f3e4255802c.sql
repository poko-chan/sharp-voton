-- 1. 組織専用パックは一般公開しない
DROP POLICY IF EXISTS "packs read approved or own or admin" ON public.makron_packs;
CREATE POLICY "packs read approved or own or admin" ON public.makron_packs
FOR SELECT TO authenticated
USING (
  (organization_id IS NULL AND status = 'approved')
  OR created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

-- 2. 組織課題
CREATE TABLE public.org_pack_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pack_id uuid NOT NULL REFERENCES public.makron_packs(id) ON DELETE CASCADE,
  title text NOT NULL,
  instructions text,
  due_at timestamptz,
  required boolean NOT NULL DEFAULT true,
  assign_all boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_pack_assignments TO authenticated;
GRANT ALL ON public.org_pack_assignments TO service_role;
ALTER TABLE public.org_pack_assignments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.org_assignment_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.org_pack_assignments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_assignment_targets TO authenticated;
GRANT ALL ON public.org_assignment_targets TO service_role;
ALTER TABLE public.org_assignment_targets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_org_staff(_org uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS(SELECT 1 FROM public.organization_members
    WHERE organization_id=_org AND user_id=_user AND role IN ('owner','admin','teacher') AND NOT suspended)
$$;

CREATE POLICY "org assignments staff manage" ON public.org_pack_assignments
FOR ALL TO authenticated
USING (public.is_org_staff(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'))
WITH CHECK (public.is_org_staff(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "org assignments members read" ON public.org_pack_assignments
FOR SELECT TO authenticated
USING (
  public.is_org_member(organization_id, auth.uid())
  AND (assign_all OR EXISTS (
    SELECT 1 FROM public.org_assignment_targets t
    WHERE t.assignment_id = org_pack_assignments.id AND t.user_id = auth.uid()
  ))
);

CREATE POLICY "org targets staff manage" ON public.org_assignment_targets
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.org_pack_assignments a WHERE a.id = assignment_id
  AND (public.is_org_staff(a.organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.org_pack_assignments a WHERE a.id = assignment_id
  AND (public.is_org_staff(a.organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'))));

CREATE POLICY "org targets self read" ON public.org_assignment_targets
FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER org_pack_assignments_updated
BEFORE UPDATE ON public.org_pack_assignments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. 組織メンバーが見られる組織パック（課題用）
CREATE INDEX IF NOT EXISTS idx_org_assignments_org ON public.org_pack_assignments(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_targets_user ON public.org_assignment_targets(user_id);

-- 4. 課題の進捗
CREATE OR REPLACE FUNCTION public.org_assignment_progress(_assignment uuid)
RETURNS TABLE (
  user_id uuid, username text, display_name text, role text,
  best_score integer, best_points integer, passed boolean,
  attempts integer, last_at timestamptz, done boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE a public.org_pack_assignments;
BEGIN
  SELECT * INTO a FROM public.org_pack_assignments WHERE id = _assignment;
  IF a.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF NOT (public.is_org_staff(a.organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'forbidden'; END IF;

  RETURN QUERY
  WITH targets AS (
    SELECT m.user_id, m.role::text AS role
    FROM public.organization_members m
    WHERE m.organization_id = a.organization_id
      AND (a.assign_all OR EXISTS (
        SELECT 1 FROM public.org_assignment_targets t
        WHERE t.assignment_id = a.id AND t.user_id = m.user_id))
  ), sess AS (
    SELECT s.user_id,
           MAX(s.total_score) AS best_score,
           MAX(s.total_points) AS best_points,
           bool_or(COALESCE(s.passed,false)) AS passed,
           COUNT(*)::int AS attempts,
           MAX(s.finished_at) AS last_at
    FROM public.makron_sessions s
    WHERE s.pack_id = a.pack_id AND s.finished_at IS NOT NULL
    GROUP BY s.user_id
  )
  SELECT t.user_id, p.username, p.display_name, t.role,
         COALESCE(sess.best_score,0), COALESCE(sess.best_points,0),
         COALESCE(sess.passed,false), COALESCE(sess.attempts,0), sess.last_at,
         (sess.user_id IS NOT NULL)
  FROM targets t
  LEFT JOIN sess ON sess.user_id = t.user_id
  LEFT JOIN public.profiles p ON p.id = t.user_id
  ORDER BY (sess.user_id IS NOT NULL), p.display_name NULLS LAST;
END $$;

-- 5. 課題の通知（作成時に対象者へ）
CREATE OR REPLACE FUNCTION public.notify_org_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.notifications(user_id, type, title, body)
  SELECT m.user_id, 'org_assignment', '新しい課題が出されました',
         NEW.title || CASE WHEN NEW.due_at IS NULL THEN '' ELSE '（期限: ' || to_char(NEW.due_at AT TIME ZONE 'Asia/Tokyo', 'MM/DD HH24:MI') || '）' END
  FROM public.organization_members m
  WHERE m.organization_id = NEW.organization_id AND NOT m.suspended AND NEW.assign_all;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_org_assignment
AFTER INSERT ON public.org_pack_assignments
FOR EACH ROW EXECUTE FUNCTION public.notify_org_assignment();

CREATE OR REPLACE FUNCTION public.notify_org_assignment_target()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE a public.org_pack_assignments;
BEGIN
  SELECT * INTO a FROM public.org_pack_assignments WHERE id = NEW.assignment_id;
  IF a.id IS NOT NULL AND NOT a.assign_all THEN
    INSERT INTO public.notifications(user_id, type, title, body)
    VALUES (NEW.user_id, 'org_assignment', '新しい課題が出されました', a.title);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_org_assignment_target
AFTER INSERT ON public.org_assignment_targets
FOR EACH ROW EXECUTE FUNCTION public.notify_org_assignment_target();

-- 6. 参加申請を管理者へ通知
CREATE OR REPLACE FUNCTION public.notify_org_join_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE oname text;
BEGIN
  IF NEW.status <> 'pending' THEN RETURN NEW; END IF;
  SELECT name INTO oname FROM public.organizations WHERE id = NEW.organization_id;
  INSERT INTO public.notifications(user_id, type, title, body)
  SELECT m.user_id, 'org_join_request', '組織への参加申請が届きました', COALESCE(oname,'組織') || ' に新しい参加申請があります'
  FROM public.organization_members m
  WHERE m.organization_id = NEW.organization_id AND m.role IN ('owner','admin') AND NOT m.suspended;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_org_join_request ON public.organization_join_requests;
CREATE TRIGGER trg_notify_org_join_request
AFTER INSERT OR UPDATE OF status ON public.organization_join_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_org_join_request();