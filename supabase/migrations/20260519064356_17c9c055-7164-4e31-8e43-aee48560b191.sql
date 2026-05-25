
-- 1) Notifications table (generic in-app notifications)
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_owner_select" ON public.notifications FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "notif_owner_update" ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notif_owner_delete" ON public.notifications FOR DELETE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "notif_admin_insert" ON public.notifications FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);

-- 2) Classroom shared files
CREATE TABLE IF NOT EXISTS public.class_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL,
  uploader_id uuid NOT NULL,
  name text NOT NULL,
  url text NOT NULL,
  size bigint,
  mime text,
  folder text NOT NULL DEFAULT '/',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_class_files_class ON public.class_files(class_id, created_at DESC);
ALTER TABLE public.class_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cf_select" ON public.class_files FOR SELECT
  USING (public.is_class_member(class_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "cf_insert" ON public.class_files FOR INSERT
  WITH CHECK (uploader_id = auth.uid() AND public.is_class_member(class_id, auth.uid()));
CREATE POLICY "cf_delete" ON public.class_files FOR DELETE
  USING (uploader_id = auth.uid() OR public.is_class_teacher(class_id, auth.uid()));

-- 3) Per-student permissions inside a class (owner-controlled)
CREATE TABLE IF NOT EXISTS public.class_student_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL,
  student_id uuid NOT NULL,
  can_view_grades boolean NOT NULL DEFAULT true,
  can_upload_files boolean NOT NULL DEFAULT true,
  can_comment boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(class_id, student_id)
);
ALTER TABLE public.class_student_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "csp_select" ON public.class_student_permissions FOR SELECT
  USING (student_id = auth.uid() OR public.is_class_teacher(class_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "csp_write_teacher" ON public.class_student_permissions FOR ALL
  USING (public.is_class_teacher(class_id, auth.uid()))
  WITH CHECK (public.is_class_teacher(class_id, auth.uid()));

-- 4) Add visibility flag to feedback for filter (review/action)
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS user_notified_at timestamptz;
