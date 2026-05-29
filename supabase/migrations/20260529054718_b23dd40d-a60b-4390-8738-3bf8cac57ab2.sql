
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "profiles_update_own_or_admin" ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_insert_own_or_admin" ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_delete_admin" ON public.profiles FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY profiles_select_authenticated ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "roles_select_own_or_admin" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles_admin_all" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, display_name)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#10b981',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subjects_owner_all" ON public.subjects FOR ALL
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.study_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time TIME,
  duration_minutes INT NOT NULL DEFAULT 0,
  content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.study_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "logs_owner_all" ON public.study_logs FOR ALL
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_study_logs_user_date ON public.study_logs(user_id, date);

CREATE TABLE public.study_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  start_time TIME,
  planned_minutes INT NOT NULL DEFAULT 0,
  content TEXT,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.study_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_owner_all" ON public.study_plans FOR ALL
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.app_settings (
  id INT PRIMARY KEY DEFAULT 1,
  maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
  maintenance_message TEXT,
  maintenance_until TIMESTAMPTZ,
  app_version TEXT NOT NULL DEFAULT 'v1.0.0',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
CREATE POLICY "settings_read_all" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "settings_admin_write" ON public.app_settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  format TEXT NOT NULL,
  question TEXT NOT NULL,
  options JSONB,
  answer TEXT NOT NULL,
  explanation TEXT,
  was_wrong BOOLEAN DEFAULT FALSE,
  attempts INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "q_owner_all" ON public.questions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.ai_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_owner_all" ON public.ai_chats FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  content text NOT NULL,
  edited_at timestamptz,
  deleted_at timestamptz,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_pair ON public.chat_messages (sender_id, recipient_id, created_at);
CREATE INDEX idx_chat_recipient ON public.chat_messages (recipient_id, created_at);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_select_participants ON public.chat_messages FOR SELECT
  USING ((auth.uid() = sender_id) OR (auth.uid() = recipient_id) OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY chat_insert_own ON public.chat_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);
CREATE POLICY chat_update_own ON public.chat_messages FOR UPDATE
  USING ((auth.uid() = sender_id) OR (auth.uid() = recipient_id) OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK ((auth.uid() = sender_id) OR (auth.uid() = recipient_id) OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY chat_delete_own ON public.chat_messages FOR DELETE
  USING ((auth.uid() = sender_id) OR has_role(auth.uid(),'admin'::app_role));
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_uniq ON public.profiles (lower(username)) WHERE username IS NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_daily_reminder boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_chat boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_streak_break boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_email boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_announcements boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_time time NOT NULL DEFAULT '20:00',
  ADD COLUMN IF NOT EXISTS deletion_code text,
  ADD COLUMN IF NOT EXISTS deletion_code_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_scheduled_at timestamptz;

CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  target_minutes integer NOT NULL DEFAULT 0,
  deadline date,
  done boolean NOT NULL DEFAULT false,
  scope text NOT NULL DEFAULT 'all',
  progress_minutes integer NOT NULL DEFAULT 0,
  count_from timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY goals_owner_all ON public.goals
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.tutor_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT '新しいチャット',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tutor_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY tt_owner_all ON public.tutor_threads FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_tt_user ON public.tutor_threads(user_id, updated_at DESC);

CREATE TABLE public.tutor_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  thread_id uuid,
  role text NOT NULL,
  content text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tutor_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY tutor_owner_all ON public.tutor_messages
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_tm_thread ON public.tutor_messages(thread_id, created_at);

INSERT INTO storage.buckets (id, name, public) VALUES ('tutor-files', 'tutor-files', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "tutor_files_read_public" ON storage.objects FOR SELECT USING (bucket_id = 'tutor-files');
CREATE POLICY "tutor_files_owner_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tutor-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "tutor_files_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'tutor-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  start_time TIME,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY events_owner_all ON public.events
  FOR ALL USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(),'admin'::app_role));

INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update their own avatar" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own avatar" ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  tag text NOT NULL DEFAULT 'other',
  publish_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  show_on_login boolean NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "announcements_read_published" ON public.announcements FOR SELECT TO authenticated
  USING (publish_at <= now() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "announcements_admin_all" ON public.announcements FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY announcements_login_public ON public.announcements FOR SELECT TO anon, authenticated
  USING (show_on_login = true AND publish_at <= now());
CREATE TRIGGER trg_announcements_updated_at BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_announcements_publish_at ON public.announcements(publish_at DESC);

CREATE TABLE public.grading_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  question_id uuid NOT NULL,
  user_answer text NOT NULL,
  score integer NOT NULL,
  correct boolean NOT NULL,
  feedback text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.grading_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY gh_owner_all ON public.grading_history FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_gh_question ON public.grading_history(question_id, created_at DESC);
CREATE INDEX idx_gh_user ON public.grading_history(user_id, created_at DESC);

CREATE TABLE public.user_coins (
  user_id uuid PRIMARY KEY,
  balance integer NOT NULL DEFAULT 0,
  total_earned integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_coins ENABLE ROW LEVEL SECURITY;
CREATE POLICY uc_owner ON public.user_coins FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.town_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_key text NOT NULL,
  x integer NOT NULL DEFAULT 50,
  y integer NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.town_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY ti_owner ON public.town_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_ti_user ON public.town_items(user_id);

CREATE TABLE public.town_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.town_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY te_owner ON public.town_events FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_te_user ON public.town_events(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_user_study_stats(_user_ids uuid[])
RETURNS TABLE(user_id uuid, total_minutes integer, last_date date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.user_id, COALESCE(SUM(s.duration_minutes), 0)::int AS total_minutes, MAX(s.date) AS last_date
  FROM public.study_logs s WHERE s.user_id = ANY(_user_ids) GROUP BY s.user_id
$$;
GRANT EXECUTE ON FUNCTION public.get_user_study_stats(uuid[]) TO authenticated;

-- Classes
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
GRANT EXECUTE ON FUNCTION public.is_class_member(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_class_teacher(uuid, uuid) TO authenticated, anon;

CREATE POLICY classes_select ON public.classes FOR SELECT
  USING (owner_id = auth.uid() OR public.is_class_member(id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY classes_insert ON public.classes FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY classes_update ON public.classes FOR UPDATE
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY classes_delete ON public.classes FOR DELETE
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY cm_select ON public.class_members FOR SELECT
  USING (user_id = auth.uid() OR public.is_class_member(class_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY cm_insert_self ON public.class_members FOR INSERT
  WITH CHECK (user_id = auth.uid() OR public.is_class_teacher(class_id, auth.uid()));
CREATE POLICY cm_delete ON public.class_members FOR DELETE
  USING (user_id = auth.uid() OR public.is_class_teacher(class_id, auth.uid()));
CREATE POLICY cm_update_teacher ON public.class_members FOR UPDATE
  USING (public.is_class_teacher(class_id, auth.uid()));

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
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  allowed_file_types text[],
  kind text NOT NULL DEFAULT 'standard',
  quiz_questions jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_assignments_class ON public.assignments(class_id);
CREATE POLICY asg_select ON public.assignments FOR SELECT
  USING (public.is_class_member(class_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY asg_insert ON public.assignments FOR INSERT WITH CHECK (public.is_class_teacher(class_id, auth.uid()));
CREATE POLICY asg_update ON public.assignments FOR UPDATE USING (public.is_class_teacher(class_id, auth.uid()));
CREATE POLICY asg_delete ON public.assignments FOR DELETE USING (public.is_class_teacher(class_id, auth.uid()));

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
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  quiz_answers jsonb,
  UNIQUE(assignment_id, user_id)
);
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_submissions_user ON public.submissions(user_id);
CREATE INDEX idx_submissions_assignment ON public.submissions(assignment_id);

CREATE OR REPLACE FUNCTION public.can_view_submission(_assignment_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = _assignment_id AND public.is_class_teacher(a.class_id, _user_id))
$$;
GRANT EXECUTE ON FUNCTION public.can_view_submission(uuid, uuid) TO authenticated, anon;

CREATE POLICY sub_select ON public.submissions FOR SELECT
  USING (user_id = auth.uid() OR public.can_view_submission(assignment_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY sub_insert_self ON public.submissions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY sub_update ON public.submissions FOR UPDATE
  USING (user_id = auth.uid() OR public.can_view_submission(assignment_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY sub_delete ON public.submissions FOR DELETE
  USING (user_id = auth.uid() OR public.can_view_submission(assignment_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY logs_teacher_view ON public.study_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.class_members cm
    JOIN public.class_members tm ON tm.class_id = cm.class_id
    WHERE cm.user_id = study_logs.user_id AND tm.user_id = auth.uid()
      AND (tm.role = 'teacher' OR EXISTS(SELECT 1 FROM public.classes c WHERE c.id = cm.class_id AND c.owner_id = auth.uid()))));

CREATE OR REPLACE FUNCTION public.join_class_by_code(_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_class_id uuid; v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT id INTO v_class_id FROM public.classes WHERE invite_code = upper(trim(_code)) LIMIT 1;
  IF v_class_id IS NULL THEN RAISE EXCEPTION 'クラスが見つかりません'; END IF;
  INSERT INTO public.class_members (class_id, user_id, role) VALUES (v_class_id, v_user, 'student')
    ON CONFLICT (class_id, user_id) DO NOTHING;
  RETURN v_class_id;
END $$;
GRANT EXECUTE ON FUNCTION public.join_class_by_code(text) TO authenticated;

CREATE TRIGGER classes_updated BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER assignments_updated BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.towns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT '私の町',
  town_goal text NOT NULL DEFAULT '',
  stage integer NOT NULL DEFAULT 0,
  max_stage_reached integer NOT NULL DEFAULT 0,
  archived boolean NOT NULL DEFAULT false,
  last_judged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.towns ENABLE ROW LEVEL SECURITY;
CREATE POLICY towns_owner_all ON public.towns FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER towns_set_updated_at BEFORE UPDATE ON public.towns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.town_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  town_id uuid NOT NULL REFERENCES public.towns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  stage_before integer NOT NULL,
  stage_after integer NOT NULL,
  delta integer NOT NULL,
  reason text,
  narrative text,
  ai_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.town_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY th_owner_all ON public.town_history FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_towns_user ON public.towns(user_id);
CREATE INDEX idx_town_history_town ON public.town_history(town_id, created_at DESC);

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
  USING (public.is_class_member(class_id, auth.uid())
    AND (private_to IS NULL OR private_to = auth.uid() OR author_id = auth.uid()
      OR public.is_class_teacher(class_id, auth.uid())));
CREATE POLICY cpc_insert ON public.class_post_comments FOR INSERT
  WITH CHECK (author_id = auth.uid() AND public.is_class_member(class_id, auth.uid())
    AND (private_to IS NULL OR public.is_class_teacher(class_id, auth.uid())));
CREATE POLICY cpc_delete ON public.class_post_comments FOR DELETE
  USING (author_id = auth.uid() OR public.is_class_teacher(class_id, auth.uid()));

INSERT INTO storage.buckets (id, name, public) VALUES ('classroom-files', 'classroom-files', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "classroom_files_read" ON storage.objects FOR SELECT USING (bucket_id = 'classroom-files');
CREATE POLICY "classroom_files_insert_own" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'classroom-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "classroom_files_delete_own" ON storage.objects FOR DELETE
  USING (bucket_id = 'classroom-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text,
  category text NOT NULL DEFAULT 'other',
  body text NOT NULL,
  route text,
  user_agent text,
  status text NOT NULL DEFAULT 'open',
  admin_reply text,
  replied_at timestamptz,
  user_notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY fb_insert_any ON public.feedback FOR INSERT
  WITH CHECK ((auth.uid() IS NULL AND user_id IS NULL) OR (auth.uid() = user_id));
CREATE POLICY fb_select_own_or_admin ON public.feedback FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY fb_update_admin ON public.feedback FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY fb_delete_admin ON public.feedback FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.feedback_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES public.feedback(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('user','admin')),
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_feedback_messages_feedback ON public.feedback_messages(feedback_id, created_at);
ALTER TABLE public.feedback_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own thread messages" ON public.feedback_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.feedback f WHERE f.id = feedback_id AND f.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own thread messages" ON public.feedback_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid()
    AND ((sender_role = 'user' AND EXISTS (SELECT 1 FROM public.feedback f WHERE f.id = feedback_id AND f.user_id = auth.uid()))
         OR (sender_role = 'admin' AND public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "Users update read_at on their threads" ON public.feedback_messages FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.feedback f WHERE f.id = feedback_id AND f.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.protect_mcjp_roles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uname text; target_id uuid;
BEGIN
  target_id := COALESCE(NEW.user_id, OLD.user_id);
  SELECT username INTO uname FROM public.profiles WHERE id = target_id;
  IF uname IS NOT NULL AND lower(uname) LIKE 'mcjp_%' THEN
    RAISE EXCEPTION 'MCJP_ ユーザーの権限は変更できません';
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER protect_mcjp_roles_trg BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.protect_mcjp_roles();

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_owner_select" ON public.notifications FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "notif_owner_update" ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notif_owner_delete" ON public.notifications FOR DELETE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "notif_admin_insert" ON public.notifications FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);

CREATE TABLE public.class_files (
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
CREATE INDEX idx_class_files_class ON public.class_files(class_id, created_at DESC);
ALTER TABLE public.class_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cf_select" ON public.class_files FOR SELECT
  USING (public.is_class_member(class_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "cf_insert" ON public.class_files FOR INSERT
  WITH CHECK (uploader_id = auth.uid() AND public.is_class_member(class_id, auth.uid()));
CREATE POLICY "cf_delete" ON public.class_files FOR DELETE
  USING (uploader_id = auth.uid() OR public.is_class_teacher(class_id, auth.uid()));

CREATE TABLE public.class_student_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL,
  student_id uuid NOT NULL,
  can_view_grades boolean NOT NULL DEFAULT true,
  can_upload_files boolean NOT NULL DEFAULT true,
  can_comment boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_student_permissions_class_student_unique UNIQUE (class_id, student_id)
);
ALTER TABLE public.class_student_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "csp_select" ON public.class_student_permissions FOR SELECT
  USING (student_id = auth.uid() OR public.is_class_teacher(class_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "csp_write_teacher" ON public.class_student_permissions FOR ALL
  USING (public.is_class_teacher(class_id, auth.uid())) WITH CHECK (public.is_class_teacher(class_id, auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT SELECT ON public.app_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_chats TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutor_threads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutor_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT SELECT ON public.announcements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grading_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_coins TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.town_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.town_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.submissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.towns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.town_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_post_comments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback TO authenticated;
GRANT INSERT ON public.feedback TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_files TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_student_permissions TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
