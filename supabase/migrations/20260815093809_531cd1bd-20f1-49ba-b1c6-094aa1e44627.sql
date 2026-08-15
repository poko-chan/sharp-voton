
-- ========== helpers & core tables ==========
CREATE TABLE public.org_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  display_name text,
  avatar_url text,
  student_number text,
  grade text,
  class_name text,
  bio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_profiles TO authenticated;
GRANT ALL ON public.org_profiles TO service_role;
ALTER TABLE public.org_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org profiles readable by members" ON public.org_profiles FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "org profiles self manage" ON public.org_profiles FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid() OR public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER org_profiles_updated BEFORE UPDATE ON public.org_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.org_app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  app_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  label text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, app_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_app_settings TO authenticated;
GRANT ALL ON public.org_app_settings TO service_role;
ALTER TABLE public.org_app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org apps readable by members" ON public.org_app_settings FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "org apps managed by admin" ON public.org_app_settings FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER org_app_settings_updated BEFORE UPDATE ON public.org_app_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.org_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text NOT NULL DEFAULT '#3b82f6',
  leader_id uuid NOT NULL,
  created_by uuid NOT NULL,
  perms jsonb NOT NULL DEFAULT '{"post_create":false,"post_like":true,"post_comment":true,"member_view":true,"survey_create":false,"calendar_add":false,"dm_member":true,"dm_teacher":true,"group_chat_create":false}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_groups TO authenticated;
GRANT ALL ON public.org_groups TO service_role;
ALTER TABLE public.org_groups ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER org_groups_updated BEFORE UPDATE ON public.org_groups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.org_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.org_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_group_members TO authenticated;
GRANT ALL ON public.org_group_members TO service_role;
ALTER TABLE public.org_group_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_group_leader(_group uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_groups g
    WHERE g.id = _group
      AND (g.leader_id = _user OR public.is_org_admin(g.organization_id, _user) OR public.has_role(_user,'admin'))
  )
$$;

CREATE OR REPLACE FUNCTION public.is_group_member(_group uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_group_members m WHERE m.group_id = _group AND m.user_id = _user)
      OR public.is_group_leader(_group, _user)
$$;

CREATE OR REPLACE FUNCTION public.group_org(_group uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.org_groups WHERE id = _group
$$;

-- staff (teacher and above) or explicit group permission for general members
CREATE OR REPLACE FUNCTION public.group_perm(_group uuid, _key text, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _group IS NULL THEN false
    WHEN public.is_group_leader(_group, _user) THEN true
    WHEN EXISTS (SELECT 1 FROM public.org_groups g WHERE g.id=_group AND public.is_org_staff(g.organization_id,_user)) THEN true
    WHEN NOT public.is_group_member(_group, _user) THEN false
    ELSE COALESCE((SELECT (g.perms ->> _key)::boolean FROM public.org_groups g WHERE g.id=_group), false)
  END
$$;

CREATE POLICY "groups readable by org members" ON public.org_groups FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "groups create by staff" ON public.org_groups FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (public.is_org_staff(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "groups update by leader" ON public.org_groups FOR UPDATE TO authenticated
  USING (public.is_group_leader(id, auth.uid())) WITH CHECK (public.is_group_leader(id, auth.uid()));
CREATE POLICY "groups delete by leader" ON public.org_groups FOR DELETE TO authenticated
  USING (public.is_group_leader(id, auth.uid()));

CREATE POLICY "group members readable" ON public.org_group_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_group_leader(group_id, auth.uid())
      OR (public.is_group_member(group_id, auth.uid()) AND public.group_perm(group_id,'member_view', auth.uid())));
CREATE POLICY "group members managed by leader" ON public.org_group_members FOR ALL TO authenticated
  USING (public.is_group_leader(group_id, auth.uid())) WITH CHECK (public.is_group_leader(group_id, auth.uid()));

-- ========== posts ==========
CREATE TABLE public.org_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.org_groups(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  images text[] NOT NULL DEFAULT '{}',
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_posts TO authenticated;
GRANT ALL ON public.org_posts TO service_role;
ALTER TABLE public.org_posts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER org_posts_updated BEFORE UPDATE ON public.org_posts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "posts readable" ON public.org_posts FOR SELECT TO authenticated
  USING ((group_id IS NULL AND public.is_org_member(organization_id, auth.uid()))
      OR (group_id IS NOT NULL AND public.is_group_member(group_id, auth.uid()))
      OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "posts create" ON public.org_posts FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND (
    (group_id IS NULL AND public.is_org_staff(organization_id, auth.uid()))
    OR (group_id IS NOT NULL AND public.group_perm(group_id,'post_create', auth.uid()))
    OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "posts update own or leader" ON public.org_posts FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.is_org_admin(organization_id, auth.uid()) OR (group_id IS NOT NULL AND public.is_group_leader(group_id, auth.uid())))
  WITH CHECK (author_id = auth.uid() OR public.is_org_admin(organization_id, auth.uid()) OR (group_id IS NOT NULL AND public.is_group_leader(group_id, auth.uid())));
CREATE POLICY "posts delete own or leader" ON public.org_posts FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_org_admin(organization_id, auth.uid()) OR (group_id IS NOT NULL AND public.is_group_leader(group_id, auth.uid())));

CREATE OR REPLACE FUNCTION public.can_see_org_post(_post uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_posts p WHERE p.id = _post AND (
      (p.group_id IS NULL AND public.is_org_member(p.organization_id, _user))
      OR (p.group_id IS NOT NULL AND public.is_group_member(p.group_id, _user)))
  )
$$;

CREATE OR REPLACE FUNCTION public.org_post_perm(_post uuid, _key text, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT CASE
      WHEN p.group_id IS NULL THEN public.is_org_member(p.organization_id, _user)
      ELSE public.group_perm(p.group_id, _key, _user)
    END FROM public.org_posts p WHERE p.id = _post), false)
$$;

CREATE TABLE public.org_post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.org_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.org_post_likes TO authenticated;
GRANT ALL ON public.org_post_likes TO service_role;
ALTER TABLE public.org_post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post likes readable" ON public.org_post_likes FOR SELECT TO authenticated
  USING (public.can_see_org_post(post_id, auth.uid()));
CREATE POLICY "post likes insert" ON public.org_post_likes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.org_post_perm(post_id,'post_like', auth.uid()));
CREATE POLICY "post likes delete own" ON public.org_post_likes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE public.org_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.org_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_post_comments TO authenticated;
GRANT ALL ON public.org_post_comments TO service_role;
ALTER TABLE public.org_post_comments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER org_post_comments_updated BEFORE UPDATE ON public.org_post_comments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "post comments readable" ON public.org_post_comments FOR SELECT TO authenticated
  USING (public.can_see_org_post(post_id, auth.uid()));
CREATE POLICY "post comments insert" ON public.org_post_comments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.org_post_perm(post_id,'post_comment', auth.uid()));
CREATE POLICY "post comments update own" ON public.org_post_comments FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "post comments delete own or staff" ON public.org_post_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.org_posts p WHERE p.id = post_id AND (public.is_org_staff(p.organization_id, auth.uid()) OR (p.group_id IS NOT NULL AND public.is_group_leader(p.group_id, auth.uid())))));

-- ========== surveys ==========
CREATE TABLE public.org_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.org_groups(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  anonymous boolean NOT NULL DEFAULT false,
  closes_at timestamptz,
  closed boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_surveys TO authenticated;
GRANT ALL ON public.org_surveys TO service_role;
ALTER TABLE public.org_surveys ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER org_surveys_updated BEFORE UPDATE ON public.org_surveys FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "surveys readable" ON public.org_surveys FOR SELECT TO authenticated
  USING ((group_id IS NULL AND public.is_org_member(organization_id, auth.uid()))
      OR (group_id IS NOT NULL AND public.is_group_member(group_id, auth.uid()))
      OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "surveys create" ON public.org_surveys FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (
    (group_id IS NULL AND public.is_org_staff(organization_id, auth.uid()))
    OR (group_id IS NOT NULL AND public.group_perm(group_id,'survey_create', auth.uid()))
    OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "surveys manage own" ON public.org_surveys FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_org_admin(organization_id, auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.is_org_admin(organization_id, auth.uid()));
CREATE POLICY "surveys delete own" ON public.org_surveys FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_org_admin(organization_id, auth.uid()));

CREATE TABLE public.org_survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.org_surveys(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (survey_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_survey_responses TO authenticated;
GRANT ALL ON public.org_survey_responses TO service_role;
ALTER TABLE public.org_survey_responses ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER org_survey_responses_updated BEFORE UPDATE ON public.org_survey_responses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "survey responses readable" ON public.org_survey_responses FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.org_surveys s WHERE s.id = survey_id
      AND (s.created_by = auth.uid() OR public.is_org_admin(s.organization_id, auth.uid())
        OR (s.group_id IS NOT NULL AND public.is_group_leader(s.group_id, auth.uid())))));
CREATE POLICY "survey responses insert own" ON public.org_survey_responses FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.org_surveys s WHERE s.id = survey_id AND s.closed = false
      AND ((s.group_id IS NULL AND public.is_org_member(s.organization_id, auth.uid()))
        OR (s.group_id IS NOT NULL AND public.is_group_member(s.group_id, auth.uid())))));
CREATE POLICY "survey responses update own" ON public.org_survey_responses FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "survey responses delete own" ON public.org_survey_responses FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ========== calendar ==========
CREATE TABLE public.org_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.org_groups(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  location text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  all_day boolean NOT NULL DEFAULT false,
  color text NOT NULL DEFAULT '#7B6CFF',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_calendar_events TO authenticated;
GRANT ALL ON public.org_calendar_events TO service_role;
ALTER TABLE public.org_calendar_events ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER org_calendar_events_updated BEFORE UPDATE ON public.org_calendar_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "events readable" ON public.org_calendar_events FOR SELECT TO authenticated
  USING ((group_id IS NULL AND public.is_org_member(organization_id, auth.uid()))
      OR (group_id IS NOT NULL AND public.is_group_member(group_id, auth.uid()))
      OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "events create" ON public.org_calendar_events FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (
    (group_id IS NULL AND public.is_org_staff(organization_id, auth.uid()))
    OR (group_id IS NOT NULL AND public.group_perm(group_id,'calendar_add', auth.uid()))
    OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "events update own" ON public.org_calendar_events FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_org_admin(organization_id, auth.uid()) OR (group_id IS NOT NULL AND public.is_group_leader(group_id, auth.uid())))
  WITH CHECK (created_by = auth.uid() OR public.is_org_admin(organization_id, auth.uid()) OR (group_id IS NOT NULL AND public.is_group_leader(group_id, auth.uid())));
CREATE POLICY "events delete own" ON public.org_calendar_events FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_org_admin(organization_id, auth.uid()) OR (group_id IS NOT NULL AND public.is_group_leader(group_id, auth.uid())));

-- ========== digital ID ==========
CREATE TABLE public.org_digital_ids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  id_number text,
  barcode_value text,
  photo_url text,
  full_name text,
  affiliation text,
  valid_until date,
  notes text,
  issued_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_digital_ids TO authenticated;
GRANT ALL ON public.org_digital_ids TO service_role;
ALTER TABLE public.org_digital_ids ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER org_digital_ids_updated BEFORE UPDATE ON public.org_digital_ids FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "digital id readable by self or staff" ON public.org_digital_ids FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_org_staff(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "digital id managed by staff" ON public.org_digital_ids FOR ALL TO authenticated
  USING (public.is_org_staff(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_org_staff(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));

-- ========== chat ==========
CREATE TABLE public.org_chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.org_groups(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'dm',
  title text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_chat_threads TO authenticated;
GRANT ALL ON public.org_chat_threads TO service_role;
ALTER TABLE public.org_chat_threads ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER org_chat_threads_updated BEFORE UPDATE ON public.org_chat_threads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.org_chat_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.org_chat_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  last_read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (thread_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_chat_participants TO authenticated;
GRANT ALL ON public.org_chat_participants TO service_role;
ALTER TABLE public.org_chat_participants ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.org_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.org_chat_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text NOT NULL,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_chat_messages TO authenticated;
GRANT ALL ON public.org_chat_messages TO service_role;
ALTER TABLE public.org_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.org_chat_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, blocker_id, blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.org_chat_blocks TO authenticated;
GRANT ALL ON public.org_chat_blocks TO service_role;
ALTER TABLE public.org_chat_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocks own" ON public.org_chat_blocks FOR ALL TO authenticated
  USING (blocker_id = auth.uid()) WITH CHECK (blocker_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_chat_participant(_thread uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_chat_participants p WHERE p.thread_id=_thread AND p.user_id=_user AND p.status <> 'blocked')
$$;

CREATE OR REPLACE FUNCTION public.can_moderate_chat(_thread uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_chat_threads t WHERE t.id=_thread
      AND (public.is_org_staff(t.organization_id,_user) OR public.has_role(_user,'admin')))
$$;

CREATE POLICY "threads readable" ON public.org_chat_threads FOR SELECT TO authenticated
  USING (public.is_chat_participant(id, auth.uid()) OR public.can_moderate_chat(id, auth.uid()));
CREATE POLICY "threads create" ON public.org_chat_threads FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "threads update by creator" ON public.org_chat_threads FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.can_moderate_chat(id, auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.can_moderate_chat(id, auth.uid()));
CREATE POLICY "threads delete by creator" ON public.org_chat_threads FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.can_moderate_chat(id, auth.uid()));

CREATE POLICY "participants readable" ON public.org_chat_participants FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_chat_participant(thread_id, auth.uid()) OR public.can_moderate_chat(thread_id, auth.uid()));
CREATE POLICY "participants insert by thread creator" ON public.org_chat_participants FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.org_chat_threads t WHERE t.id = thread_id AND (t.created_by = auth.uid() OR public.can_moderate_chat(t.id, auth.uid()))));
CREATE POLICY "participants update self" ON public.org_chat_participants FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.can_moderate_chat(thread_id, auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.can_moderate_chat(thread_id, auth.uid()));
CREATE POLICY "participants delete" ON public.org_chat_participants FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.can_moderate_chat(thread_id, auth.uid()));

CREATE POLICY "messages readable" ON public.org_chat_messages FOR SELECT TO authenticated
  USING (public.is_chat_participant(thread_id, auth.uid()) OR public.can_moderate_chat(thread_id, auth.uid()));
CREATE POLICY "messages insert" ON public.org_chat_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.org_chat_participants p WHERE p.thread_id = thread_id AND p.user_id = auth.uid() AND p.status = 'accepted'));
CREATE POLICY "messages update own" ON public.org_chat_messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());
CREATE POLICY "messages delete own or moderator" ON public.org_chat_messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR public.can_moderate_chat(thread_id, auth.uid()));

-- ========== org notifications ==========
CREATE TABLE public.org_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  app_key text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_notifications TO authenticated;
GRANT ALL ON public.org_notifications TO service_role;
ALTER TABLE public.org_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org notifications own" ON public.org_notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "org notifications update own" ON public.org_notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "org notifications delete own" ON public.org_notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "org notifications insert by staff" ON public.org_notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE INDEX idx_org_notifications_user ON public.org_notifications(user_id, created_at DESC);
CREATE INDEX idx_org_posts_org ON public.org_posts(organization_id, created_at DESC);
CREATE INDEX idx_org_events_org ON public.org_calendar_events(organization_id, starts_at);
CREATE INDEX idx_org_chat_messages_thread ON public.org_chat_messages(thread_id, created_at);

-- ========== RPCs ==========
CREATE OR REPLACE FUNCTION public.org_create_group(_org uuid, _name text, _description text DEFAULT NULL, _color text DEFAULT '#3b82f6', _perms jsonb DEFAULT NULL, _members jsonb DEFAULT '[]'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE gid uuid; m jsonb;
BEGIN
  IF NOT (public.is_org_staff(_org, auth.uid()) OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'グループを作成する権限がありません';
  END IF;
  INSERT INTO public.org_groups (organization_id, name, description, color, leader_id, created_by, perms)
  VALUES (_org, _name, _description, COALESCE(_color,'#3b82f6'), auth.uid(), auth.uid(),
          COALESCE(_perms, '{"post_create":false,"post_like":true,"post_comment":true,"member_view":true,"survey_create":false,"calendar_add":false,"dm_member":true,"dm_teacher":true,"group_chat_create":false}'::jsonb))
  RETURNING id INTO gid;
  INSERT INTO public.org_group_members (group_id, user_id, role) VALUES (gid, auth.uid(), 'admin')
    ON CONFLICT DO NOTHING;
  FOR m IN SELECT * FROM jsonb_array_elements(COALESCE(_members,'[]'::jsonb)) LOOP
    INSERT INTO public.org_group_members (group_id, user_id, role)
    VALUES (gid, (m->>'user_id')::uuid, COALESCE(m->>'role','member'))
    ON CONFLICT (group_id, user_id) DO UPDATE SET role = EXCLUDED.role;
  END LOOP;
  RETURN gid;
END; $$;

CREATE OR REPLACE FUNCTION public.org_start_dm(_org uuid, _other uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tid uuid;
BEGIN
  IF NOT public.is_org_member(_org, auth.uid()) OR NOT public.is_org_member(_org, _other) THEN
    RAISE EXCEPTION '組織メンバーのみDMできます';
  END IF;
  IF EXISTS (SELECT 1 FROM public.org_chat_blocks b WHERE b.organization_id=_org AND ((b.blocker_id=_other AND b.blocked_id=auth.uid()) OR (b.blocker_id=auth.uid() AND b.blocked_id=_other))) THEN
    RAISE EXCEPTION 'ブロックされているため会話を開始できません';
  END IF;
  SELECT t.id INTO tid FROM public.org_chat_threads t
   WHERE t.organization_id=_org AND t.kind='dm'
     AND EXISTS (SELECT 1 FROM public.org_chat_participants p WHERE p.thread_id=t.id AND p.user_id=auth.uid())
     AND EXISTS (SELECT 1 FROM public.org_chat_participants p WHERE p.thread_id=t.id AND p.user_id=_other)
   LIMIT 1;
  IF tid IS NOT NULL THEN RETURN tid; END IF;
  INSERT INTO public.org_chat_threads (organization_id, kind, created_by) VALUES (_org,'dm',auth.uid()) RETURNING id INTO tid;
  INSERT INTO public.org_chat_participants (thread_id, user_id, status) VALUES (tid, auth.uid(), 'accepted'), (tid, _other, 'pending');
  INSERT INTO public.org_notifications (organization_id, user_id, app_key, title, body)
    VALUES (_org, _other, 'chat', 'チャットのリクエストが届きました', 'チャットアプリから承認できます');
  RETURN tid;
END; $$;

CREATE OR REPLACE FUNCTION public.org_notify_members(_org uuid, _group uuid, _app text, _title text, _body text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF NOT public.is_org_member(_org, auth.uid()) THEN RAISE EXCEPTION 'not a member'; END IF;
  IF _group IS NULL THEN
    INSERT INTO public.org_notifications (organization_id, user_id, app_key, title, body)
    SELECT _org, m.user_id, _app, _title, _body FROM public.organization_members m
     WHERE m.organization_id=_org AND m.user_id <> auth.uid();
  ELSE
    INSERT INTO public.org_notifications (organization_id, user_id, app_key, title, body)
    SELECT _org, gm.user_id, _app, _title, _body FROM public.org_group_members gm
     WHERE gm.group_id=_group AND gm.user_id <> auth.uid();
  END IF;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END; $$;
