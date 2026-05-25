
-- 1. Profiles: allow authenticated users to read basic info of all profiles (needed for chat user picker)
DROP POLICY IF EXISTS profiles_select_own_or_admin ON public.profiles;
CREATE POLICY profiles_select_authenticated ON public.profiles
  FOR SELECT TO authenticated USING (true);

-- 2. Notification preferences
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_daily_reminder boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_chat boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_streak_break boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_email boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_time time NOT NULL DEFAULT '20:00';

-- 3. Goals (学習目標) — recommended new feature
CREATE TABLE IF NOT EXISTS public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  target_minutes integer NOT NULL DEFAULT 0,
  deadline date,
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY goals_owner_all ON public.goals
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. AI tutor messages with attached files
CREATE TABLE IF NOT EXISTS public.tutor_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tutor_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY tutor_owner_all ON public.tutor_messages
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. Storage bucket for tutor file uploads (public read so AI/links can fetch)
INSERT INTO storage.buckets (id, name, public)
VALUES ('tutor-files', 'tutor-files', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "tutor_files_read_public" ON storage.objects
  FOR SELECT USING (bucket_id = 'tutor-files');

CREATE POLICY "tutor_files_owner_write" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'tutor-files' AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "tutor_files_owner_delete" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'tutor-files' AND auth.uid()::text = (storage.foldername(name))[1]
  );
