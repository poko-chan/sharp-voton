-- ============================================================
-- Chat extension: DM hide, DM read tracking helper, group chat
-- ============================================================

-- 1) DM: per-user logical hide of a conversation ---------------------------
CREATE TABLE IF NOT EXISTS public.dm_hidden_conversations (
  user_id uuid NOT NULL,
  other_user_id uuid NOT NULL,
  hidden_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, other_user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dm_hidden_conversations TO authenticated;
GRANT ALL ON public.dm_hidden_conversations TO service_role;
ALTER TABLE public.dm_hidden_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY dhc_owner ON public.dm_hidden_conversations FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RPC: hide a DM conversation for the caller only (logical delete)
CREATE OR REPLACE FUNCTION public.hide_dm_conversation(_other uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.dm_hidden_conversations(user_id, other_user_id, hidden_at)
  VALUES (auth.uid(), _other, now())
  ON CONFLICT (user_id, other_user_id) DO UPDATE SET hidden_at = now();
END $$;
GRANT EXECUTE ON FUNCTION public.hide_dm_conversation(uuid) TO authenticated;

-- ============================================================
-- 2) Group chats
-- ============================================================
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

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_group_messages;
ALTER TABLE public.chat_group_messages REPLICA IDENTITY FULL;

-- SECURITY DEFINER helper to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.is_chat_group_member(_group uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_group_members m WHERE m.group_id = _group AND m.user_id = _user
  )
$$;
GRANT EXECUTE ON FUNCTION public.is_chat_group_member(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_chat_group_owner(_group uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_groups g WHERE g.id = _group AND g.created_by = _user
  )
$$;
GRANT EXECUTE ON FUNCTION public.is_chat_group_owner(uuid, uuid) TO authenticated;

-- RLS: chat_groups
CREATE POLICY cg_select ON public.chat_groups FOR SELECT TO authenticated
  USING (public.is_chat_group_member(id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY cg_insert ON public.chat_groups FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY cg_update ON public.chat_groups FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY cg_delete ON public.chat_groups FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- RLS: chat_group_members
CREATE POLICY cgm_select ON public.chat_group_members FOR SELECT TO authenticated
  USING (public.is_chat_group_member(group_id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
-- Owner can add anyone; any existing member can invite new members; users can insert themselves only at group creation (handled via RPC using SECURITY DEFINER, direct inserts restricted to owner/member)
CREATE POLICY cgm_insert ON public.chat_group_members FOR INSERT TO authenticated
  WITH CHECK (
    public.is_chat_group_owner(group_id, auth.uid())
    OR public.is_chat_group_member(group_id, auth.uid())
  );
-- Self update (last_read_at)
CREATE POLICY cgm_update_self ON public.chat_group_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_chat_group_owner(group_id, auth.uid()) OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (user_id = auth.uid() OR public.is_chat_group_owner(group_id, auth.uid()) OR has_role(auth.uid(),'admin'::app_role));
-- Self leave, or owner removes a member
CREATE POLICY cgm_delete ON public.chat_group_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_chat_group_owner(group_id, auth.uid()) OR has_role(auth.uid(),'admin'::app_role));

-- RLS: chat_group_messages
CREATE POLICY cgmsg_select ON public.chat_group_messages FOR SELECT TO authenticated
  USING (public.is_chat_group_member(group_id, auth.uid()) OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY cgmsg_insert ON public.chat_group_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_chat_group_member(group_id, auth.uid()));
CREATE POLICY cgmsg_update ON public.chat_group_messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (sender_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY cgmsg_delete ON public.chat_group_messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role));

-- RPC: create a group with initial members (creator becomes owner + member)
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
        INSERT INTO public.chat_group_members(group_id, user_id) VALUES (v_group, v_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;
  RETURN v_group;
END $$;
GRANT EXECUTE ON FUNCTION public.create_chat_group(text, uuid[]) TO authenticated;

-- RPC: invite a member (any existing member may invite)
CREATE OR REPLACE FUNCTION public.invite_to_chat_group(_group uuid, _user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.is_chat_group_member(_group, auth.uid()) THEN RAISE EXCEPTION 'メンバーのみ招待できます'; END IF;
  IF _user_id IS NULL THEN RAISE EXCEPTION '不正なユーザーです'; END IF;
  INSERT INTO public.chat_group_members(group_id, user_id) VALUES (_group, _user_id)
  ON CONFLICT DO NOTHING;
END $$;
GRANT EXECUTE ON FUNCTION public.invite_to_chat_group(uuid, uuid) TO authenticated;

-- RPC: remove a member (only the group creator)
CREATE OR REPLACE FUNCTION public.remove_from_chat_group(_group uuid, _user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.is_chat_group_owner(_group, auth.uid()) THEN RAISE EXCEPTION '作成者のみメンバーを削除できます'; END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION '作成者自身は退出のみ可能です'; END IF;
  DELETE FROM public.chat_group_members WHERE group_id = _group AND user_id = _user_id;
END $$;
GRANT EXECUTE ON FUNCTION public.remove_from_chat_group(uuid, uuid) TO authenticated;

-- RPC: leave a group (any member; if owner leaves, ownership stays but no other member can be removed until admin reassigns — acceptable for now)
CREATE OR REPLACE FUNCTION public.leave_chat_group(_group uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  DELETE FROM public.chat_group_members WHERE group_id = _group AND user_id = auth.uid();
END $$;
GRANT EXECUTE ON FUNCTION public.leave_chat_group(uuid) TO authenticated;

-- RPC: send a group message
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
GRANT EXECUTE ON FUNCTION public.send_group_message(uuid, text) TO authenticated;

-- RPC: mark a group as read for the caller
CREATE OR REPLACE FUNCTION public.mark_group_read(_group uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  UPDATE public.chat_group_members SET last_read_at = now() WHERE group_id = _group AND user_id = auth.uid();
END $$;
GRANT EXECUTE ON FUNCTION public.mark_group_read(uuid) TO authenticated;

-- ============================================================
-- 3) Unified conversation list RPC (DM + groups) with unread counts
-- ============================================================
CREATE OR REPLACE FUNCTION public.list_chat_conversations()
RETURNS TABLE (
  conv_type text,
  conv_id uuid,
  display_name text,
  last_message text,
  last_message_at timestamptz,
  unread_count integer,
  member_count integer
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  RETURN QUERY
  -- DM conversations
  SELECT
    'dm'::text AS conv_type,
    other_id AS conv_id,
    COALESCE(p.display_name, p.username, '')::text AS display_name,
    lm.content AS last_message,
    lm.created_at AS last_message_at,
    COALESCE(uc.cnt, 0)::integer AS unread_count,
    2 AS member_count
  FROM (
    SELECT DISTINCT
      CASE WHEN cm.sender_id = v_user THEN cm.recipient_id ELSE cm.sender_id END AS other_id
    FROM public.chat_messages cm
    WHERE cm.sender_id = v_user OR cm.recipient_id = v_user
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

  -- Group conversations
  SELECT
    'group'::text AS conv_type,
    g.id AS conv_id,
    g.name::text AS display_name,
    gm_last.content AS last_message,
    gm_last.created_at AS last_message_at,
    COALESCE(gc.cnt, 0)::integer AS unread_count,
    (SELECT count(*)::int FROM public.chat_group_members mm WHERE mm.group_id = g.id) AS member_count
  FROM public.chat_group_members me
  JOIN public.chat_groups g ON g.id = me.group_id
  LEFT JOIN LATERAL (
    SELECT content, created_at FROM public.chat_group_messages gm
    WHERE gm.group_id = g.id
    ORDER BY gm.created_at DESC LIMIT 1
  ) gm_last ON true
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS cnt FROM public.chat_group_messages gm2
    WHERE gm2.group_id = g.id AND gm2.created_at > me.last_read_at
      AND gm2.sender_id <> v_user AND gm2.deleted_at IS NULL
  ) gc ON true
  WHERE me.user_id = v_user

  ORDER BY unread_count DESC, last_message_at DESC NULLS LAST;
END $$;
GRANT EXECUTE ON FUNCTION public.list_chat_conversations() TO authenticated;
