
-- Stream posts
CREATE TABLE public.class_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL,
  author_id uuid NOT NULL,
  title text,
  body text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.class_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY cp_select ON public.class_posts FOR SELECT
  USING (public.is_class_member(class_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY cp_insert ON public.class_posts FOR INSERT
  WITH CHECK (public.is_class_teacher(class_id, auth.uid()) AND author_id = auth.uid());
CREATE POLICY cp_update ON public.class_posts FOR UPDATE
  USING (public.is_class_teacher(class_id, auth.uid()));
CREATE POLICY cp_delete ON public.class_posts FOR DELETE
  USING (public.is_class_teacher(class_id, auth.uid()));

CREATE TRIGGER class_posts_updated BEFORE UPDATE ON public.class_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Comments
CREATE TABLE public.class_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.class_posts(id) ON DELETE CASCADE,
  class_id uuid NOT NULL,
  author_id uuid NOT NULL,
  body text NOT NULL,
  private_to uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.class_post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY cpc_select ON public.class_post_comments FOR SELECT
  USING (
    public.is_class_member(class_id, auth.uid())
    AND (
      private_to IS NULL
      OR private_to = auth.uid()
      OR author_id = auth.uid()
      OR public.is_class_teacher(class_id, auth.uid())
    )
  );
CREATE POLICY cpc_insert ON public.class_post_comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND public.is_class_member(class_id, auth.uid())
    AND (private_to IS NULL OR public.is_class_teacher(class_id, auth.uid()))
  );
CREATE POLICY cpc_delete ON public.class_post_comments FOR DELETE
  USING (author_id = auth.uid() OR public.is_class_teacher(class_id, auth.uid()));

-- Assignments: attachments, file types, quiz mode
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS allowed_file_types text[],
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS quiz_questions jsonb;

-- Submissions: attachments, quiz answers
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS quiz_answers jsonb;

-- Storage bucket for classroom files
INSERT INTO storage.buckets (id, name, public)
  VALUES ('classroom-files', 'classroom-files', true)
  ON CONFLICT (id) DO NOTHING;

-- Storage policies: any authenticated user can upload to their own user-id folder; anyone can read (public bucket)
CREATE POLICY "classroom_files_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'classroom-files');
CREATE POLICY "classroom_files_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'classroom-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "classroom_files_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'classroom-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
