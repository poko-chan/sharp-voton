-- ================== classes ==================
CREATE TABLE public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  invite_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.class_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('teacher','student')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(class_id, user_id)
);
ALTER TABLE public.class_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_class_members_user ON public.class_members(user_id);
CREATE INDEX idx_class_members_class ON public.class_members(class_id);

-- Helper functions (SECURITY DEFINER to avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.is_class_member(_class_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.class_members WHERE class_id = _class_id AND user_id = _user_id)
     OR EXISTS(SELECT 1 FROM public.classes WHERE id = _class_id AND owner_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.is_class_teacher(_class_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.classes WHERE id = _class_id AND owner_id = _user_id)
     OR EXISTS(SELECT 1 FROM public.class_members WHERE class_id = _class_id AND user_id = _user_id AND role = 'teacher')
$$;

REVOKE EXECUTE ON FUNCTION public.is_class_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_class_teacher(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- classes policies
CREATE POLICY classes_select ON public.classes FOR SELECT
  USING (owner_id = auth.uid() OR public.is_class_member(id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY classes_insert ON public.classes FOR INSERT
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY classes_update ON public.classes FOR UPDATE
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY classes_delete ON public.classes FOR DELETE
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- class_members policies
CREATE POLICY cm_select ON public.class_members FOR SELECT
  USING (user_id = auth.uid() OR public.is_class_member(class_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY cm_insert_self ON public.class_members FOR INSERT
  WITH CHECK (user_id = auth.uid() OR public.is_class_teacher(class_id, auth.uid()));
CREATE POLICY cm_delete ON public.class_members FOR DELETE
  USING (user_id = auth.uid() OR public.is_class_teacher(class_id, auth.uid()));
CREATE POLICY cm_update_teacher ON public.class_members FOR UPDATE
  USING (public.is_class_teacher(class_id, auth.uid()));

-- ================== assignments ==================
CREATE TABLE public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  title text NOT NULL,
  description text,
  due_at timestamptz,
  max_points integer NOT NULL DEFAULT 100,
  xp_mode text NOT NULL DEFAULT 'score' CHECK (xp_mode IN ('score','fixed','none')),
  fixed_xp integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_assignments_class ON public.assignments(class_id);

CREATE POLICY asg_select ON public.assignments FOR SELECT
  USING (public.is_class_member(class_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY asg_insert ON public.assignments FOR INSERT
  WITH CHECK (public.is_class_teacher(class_id, auth.uid()));
CREATE POLICY asg_update ON public.assignments FOR UPDATE
  USING (public.is_class_teacher(class_id, auth.uid()));
CREATE POLICY asg_delete ON public.assignments FOR DELETE
  USING (public.is_class_teacher(class_id, auth.uid()));

-- ================== submissions ==================
CREATE TABLE public.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  score integer,
  feedback text,
  graded_at timestamptz,
  graded_by uuid,
  xp_awarded integer NOT NULL DEFAULT 0,
  UNIQUE(assignment_id, user_id)
);
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_submissions_user ON public.submissions(user_id);
CREATE INDEX idx_submissions_assignment ON public.submissions(assignment_id);

CREATE OR REPLACE FUNCTION public.can_view_submission(_assignment_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = _assignment_id AND public.is_class_teacher(a.class_id, _user_id)
  )
$$;
REVOKE EXECUTE ON FUNCTION public.can_view_submission(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE POLICY sub_select ON public.submissions FOR SELECT
  USING (user_id = auth.uid() OR public.can_view_submission(assignment_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY sub_insert_self ON public.submissions FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY sub_update ON public.submissions FOR UPDATE
  USING (user_id = auth.uid() OR public.can_view_submission(assignment_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY sub_delete ON public.submissions FOR DELETE
  USING (user_id = auth.uid() OR public.can_view_submission(assignment_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));

-- 教師がクラス生徒の学習記録を閲覧できるポリシーを追加
CREATE POLICY logs_teacher_view ON public.study_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.class_members cm
    JOIN public.class_members tm ON tm.class_id = cm.class_id
    WHERE cm.user_id = study_logs.user_id
      AND tm.user_id = auth.uid()
      AND (tm.role = 'teacher' OR EXISTS(SELECT 1 FROM public.classes c WHERE c.id = cm.class_id AND c.owner_id = auth.uid()))
  ));

-- 招待コードで参加する関数
CREATE OR REPLACE FUNCTION public.join_class_by_code(_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_class_id uuid;
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT id INTO v_class_id FROM public.classes WHERE invite_code = upper(trim(_code)) LIMIT 1;
  IF v_class_id IS NULL THEN RAISE EXCEPTION 'クラスが見つかりません'; END IF;
  INSERT INTO public.class_members (class_id, user_id, role)
    VALUES (v_class_id, v_user, 'student')
    ON CONFLICT (class_id, user_id) DO NOTHING;
  RETURN v_class_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.join_class_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_class_by_code(text) TO authenticated;

-- updated_at triggers
CREATE TRIGGER classes_updated BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER assignments_updated BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();