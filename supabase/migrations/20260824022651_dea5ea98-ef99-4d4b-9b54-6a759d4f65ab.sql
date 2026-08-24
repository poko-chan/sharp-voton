-- ============ 1) Flashcard decks ============
CREATE TABLE IF NOT EXISTS public.flashcard_decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT 'primary',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flashcard_decks TO authenticated;
GRANT ALL ON public.flashcard_decks TO service_role;
ALTER TABLE public.flashcard_decks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deck_owner" ON public.flashcard_decks;
CREATE POLICY "deck_owner" ON public.flashcard_decks FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.flashcards ADD COLUMN IF NOT EXISTS deck_id uuid REFERENCES public.flashcard_decks(id) ON DELETE CASCADE;
ALTER TABLE public.flashcards ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz;
ALTER TABLE public.flashcards ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

INSERT INTO public.flashcard_decks (user_id, name)
SELECT DISTINCT user_id, COALESCE(NULLIF(deck, ''), '未分類') FROM public.flashcards WHERE deck_id IS NULL
ON CONFLICT (user_id, name) DO NOTHING;

UPDATE public.flashcards f SET deck_id = d.id
FROM public.flashcard_decks d
WHERE f.deck_id IS NULL AND d.user_id = f.user_id AND d.name = COALESCE(NULLIF(f.deck, ''), '未分類');

CREATE INDEX IF NOT EXISTS flashcards_deck_id_idx ON public.flashcards (deck_id);
CREATE INDEX IF NOT EXISTS flashcards_user_id_idx ON public.flashcards (user_id);
CREATE INDEX IF NOT EXISTS flashcard_decks_user_id_idx ON public.flashcard_decks (user_id);

-- ============ 2) Chat: hide DM + group chat ============
CREATE TABLE IF NOT EXISTS public.dm_hidden_conversations (
  user_id uuid NOT NULL,
  other_user_id uuid NOT NULL,
  hidden_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, other_user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dm_hidden_conversations TO authenticated;
GRANT ALL ON public.dm_hidden_conversations TO service_role;
ALTER TABLE public.dm_hidden_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dhc_owner ON public.dm_hidden_conversations;
CREATE POLICY dhc_owner ON public.dm_hidden_conversations FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.hide_dm_conversation(_other uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.dm_hidden_conversations(user_id, other_user_id, hidden_at)
  VALUES (auth.uid(), _other, now())
  ON CONFLICT (user_id, other_user_id) DO UPDATE SET hidden_at = now();
END $$;
REVOKE ALL ON FUNCTION public.hide_dm_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hide_dm_conversation(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.chat_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_groups TO authenticated;
GRANT ALL ON public.chat_groups TO service_role;
ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.chat_group_members (
  group_id uuid NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_group_members TO authenticated;
GRANT ALL ON public.chat_group_members TO service_role;
ALTER TABLE public.chat_group_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.chat_group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_group_messages TO authenticated;
GRANT ALL ON public.chat_group_messages TO service_role;
ALTER TABLE public.chat_group_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_cgm_group_created ON public.chat_group_messages(group_id, created_at);
ALTER TABLE public.chat_group_messages REPLICA IDENTITY FULL;

CREATE OR REPLACE FUNCTION public.is_chat_group_member(_group uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.chat_group_members m WHERE m.group_id = _group AND m.user_id = _user)
$$;
REVOKE ALL ON FUNCTION public.is_chat_group_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_chat_group_member(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_chat_group_owner(_group uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.chat_groups g WHERE g.id = _group AND g.created_by = _user)
$$;
REVOKE ALL ON FUNCTION public.is_chat_group_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_chat_group_owner(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS cg_select ON public.chat_groups;
CREATE POLICY cg_select ON public.chat_groups FOR SELECT TO authenticated
  USING (public.is_chat_group_member(id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS cg_insert ON public.chat_groups;
CREATE POLICY cg_insert ON public.chat_groups FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
DROP POLICY IF EXISTS cg_update ON public.chat_groups;
CREATE POLICY cg_update ON public.chat_groups FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS cg_delete ON public.chat_groups;
CREATE POLICY cg_delete ON public.chat_groups FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS cgm_select ON public.chat_group_members;
CREATE POLICY cgm_select ON public.chat_group_members FOR SELECT TO authenticated
  USING (public.is_chat_group_member(group_id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS cgm_insert ON public.chat_group_members;
CREATE POLICY cgm_insert ON public.chat_group_members FOR INSERT TO authenticated
  WITH CHECK (public.is_chat_group_owner(group_id, auth.uid()) OR public.is_chat_group_member(group_id, auth.uid()));
DROP POLICY IF EXISTS cgm_update_self ON public.chat_group_members;
CREATE POLICY cgm_update_self ON public.chat_group_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_chat_group_owner(group_id, auth.uid()) OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (user_id = auth.uid() OR public.is_chat_group_owner(group_id, auth.uid()) OR has_role(auth.uid(),'admin'::app_role));
DROP POLICY IF EXISTS cgm_delete ON public.chat_group_members;
CREATE POLICY cgm_delete ON public.chat_group_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_chat_group_owner(group_id, auth.uid()) OR has_role(auth.uid(),'admin'::app_role));

DROP POLICY IF EXISTS cgmsg_select ON public.chat_group_messages;
CREATE POLICY cgmsg_select ON public.chat_group_messages FOR SELECT TO authenticated
  USING (public.is_chat_group_member(group_id, auth.uid()) OR has_role(auth.uid(),'admin'::app_role));
DROP POLICY IF EXISTS cgmsg_insert ON public.chat_group_messages;
CREATE POLICY cgmsg_insert ON public.chat_group_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_chat_group_member(group_id, auth.uid()));
DROP POLICY IF EXISTS cgmsg_update ON public.chat_group_messages;
CREATE POLICY cgmsg_update ON public.chat_group_messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (sender_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role));
DROP POLICY IF EXISTS cgmsg_delete ON public.chat_group_messages;
CREATE POLICY cgmsg_delete ON public.chat_group_messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role));

CREATE OR REPLACE FUNCTION public.create_chat_group(_name text, _member_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_group uuid; v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN RAISE EXCEPTION 'グループ名が必要です'; END IF;
  INSERT INTO public.chat_groups(name, created_by) VALUES (trim(_name), auth.uid()) RETURNING id INTO v_group;
  INSERT INTO public.chat_group_members(group_id, user_id) VALUES (v_group, auth.uid());
  IF _member_ids IS NOT NULL THEN
    FOREACH v_id IN ARRAY _member_ids LOOP
      IF v_id IS NOT NULL AND v_id <> auth.uid() THEN
        INSERT INTO public.chat_group_members(group_id, user_id) VALUES (v_group, v_id) ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;
  RETURN v_group;
END $$;
REVOKE ALL ON FUNCTION public.create_chat_group(text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_chat_group(text, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.invite_to_chat_group(_group uuid, _user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.is_chat_group_member(_group, auth.uid()) THEN RAISE EXCEPTION 'メンバーのみ招待できます'; END IF;
  IF _user_id IS NULL THEN RAISE EXCEPTION '不正なユーザーです'; END IF;
  INSERT INTO public.chat_group_members(group_id, user_id) VALUES (_group, _user_id) ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.invite_to_chat_group(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invite_to_chat_group(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_from_chat_group(_group uuid, _user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.is_chat_group_owner(_group, auth.uid()) THEN RAISE EXCEPTION '作成者のみメンバーを削除できます'; END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION '作成者自身は退出のみ可能です'; END IF;
  DELETE FROM public.chat_group_members WHERE group_id = _group AND user_id = _user_id;
END $$;
REVOKE ALL ON FUNCTION public.remove_from_chat_group(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_from_chat_group(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.leave_chat_group(_group uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  DELETE FROM public.chat_group_members WHERE group_id = _group AND user_id = auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.leave_chat_group(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_chat_group(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.send_group_message(_group uuid, _content text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.is_chat_group_member(_group, auth.uid()) THEN RAISE EXCEPTION 'メンバーのみ投稿できます'; END IF;
  IF _content IS NULL OR length(trim(_content)) = 0 THEN RAISE EXCEPTION '本文が空です'; END IF;
  INSERT INTO public.chat_group_messages(group_id, sender_id, content) VALUES (_group, auth.uid(), _content) RETURNING id INTO v;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.send_group_message(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_group_message(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_group_read(_group uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  UPDATE public.chat_group_members SET last_read_at = now() WHERE group_id = _group AND user_id = auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.mark_group_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_group_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_chat_conversations()
RETURNS TABLE (
  conv_type text, conv_id uuid, display_name text, last_message text,
  last_message_at timestamptz, unread_count integer, member_count integer
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  RETURN QUERY
  SELECT 'dm'::text, parties.other_id, COALESCE(p.display_name, p.username, '')::text,
    lm.content, lm.created_at, COALESCE(uc.cnt, 0)::integer, 2
  FROM (
    SELECT DISTINCT CASE WHEN cm.sender_id = v_user THEN cm.recipient_id ELSE cm.sender_id END AS other_id
    FROM public.chat_messages cm WHERE cm.sender_id = v_user OR cm.recipient_id = v_user
  ) parties
  JOIN public.profiles p ON p.id = parties.other_id
  LEFT JOIN public.dm_hidden_conversations h ON h.user_id = v_user AND h.other_user_id = parties.other_id
  JOIN LATERAL (
    SELECT content, created_at FROM public.chat_messages m2
    WHERE (m2.sender_id = v_user AND m2.recipient_id = parties.other_id)
       OR (m2.sender_id = parties.other_id AND m2.recipient_id = v_user)
    ORDER BY m2.created_at DESC LIMIT 1
  ) lm ON true
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS cnt FROM public.chat_messages m3
    WHERE m3.recipient_id = v_user AND m3.sender_id = parties.other_id
      AND m3.read_at IS NULL AND m3.deleted_at IS NULL
  ) uc ON true
  WHERE h.hidden_at IS NULL OR lm.created_at > h.hidden_at
  UNION ALL
  SELECT 'group'::text, g.id, g.name::text, gm_last.content, gm_last.created_at,
    COALESCE(gc.cnt, 0)::integer,
    (SELECT count(*)::int FROM public.chat_group_members mm WHERE mm.group_id = g.id)
  FROM public.chat_group_members me
  JOIN public.chat_groups g ON g.id = me.group_id
  LEFT JOIN LATERAL (
    SELECT content, created_at FROM public.chat_group_messages gm
    WHERE gm.group_id = g.id ORDER BY gm.created_at DESC LIMIT 1
  ) gm_last ON true
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS cnt FROM public.chat_group_messages gm2
    WHERE gm2.group_id = g.id AND gm2.created_at > me.last_read_at
      AND gm2.sender_id <> v_user AND gm2.deleted_at IS NULL
  ) gc ON true
  WHERE me.user_id = v_user
  ORDER BY 6 DESC, 5 DESC NULLS LAST;
END $$;
REVOKE ALL ON FUNCTION public.list_chat_conversations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_chat_conversations() TO authenticated;

-- ============ 3) Timeline visibility ============
ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'followers', 'private'));
CREATE INDEX IF NOT EXISTS social_posts_visibility_idx ON public.social_posts (visibility);

CREATE OR REPLACE FUNCTION public.can_view_social_post(_post_id uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.social_posts p
    WHERE p.id = _post_id AND (
      p.user_id = _uid
      OR (p.organization_id IS NOT NULL AND public.is_org_member(p.organization_id, _uid))
      OR (p.organization_id IS NULL AND p.visibility = 'public')
      OR (p.organization_id IS NULL AND p.visibility = 'followers' AND EXISTS (
        SELECT 1 FROM public.follows f
        WHERE f.follower_id = _uid AND f.following_id = p.user_id AND f.status = 'accepted'))
    )
  )
$$;
REVOKE ALL ON FUNCTION public.can_view_social_post(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_social_post(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "read posts" ON public.social_posts;
CREATE POLICY "read posts" ON public.social_posts FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (organization_id IS NOT NULL AND public.is_org_member(organization_id, auth.uid()))
    OR (organization_id IS NULL AND visibility = 'public')
    OR (organization_id IS NULL AND visibility = 'followers' AND EXISTS (
      SELECT 1 FROM public.follows f
      WHERE f.follower_id = auth.uid() AND f.following_id = social_posts.user_id AND f.status = 'accepted'))
  );

DROP POLICY IF EXISTS "read comments" ON public.social_comments;
CREATE POLICY "read comments" ON public.social_comments FOR SELECT TO authenticated
  USING (public.can_view_social_post(post_id, auth.uid()));
DROP POLICY IF EXISTS "read likes" ON public.social_likes;
CREATE POLICY "read likes" ON public.social_likes FOR SELECT TO authenticated
  USING (public.can_view_social_post(post_id, auth.uid()));

DROP POLICY IF EXISTS "own likes" ON public.social_likes;
CREATE POLICY "own likes" ON public.social_likes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_view_social_post(post_id, auth.uid()));
DROP POLICY IF EXISTS "delete own likes" ON public.social_likes;
CREATE POLICY "delete own likes" ON public.social_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own comments" ON public.social_comments;
CREATE POLICY "own comments" ON public.social_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_view_social_post(post_id, auth.uid()));
DROP POLICY IF EXISTS "delete own comments" ON public.social_comments;
CREATE POLICY "delete own comments" ON public.social_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);