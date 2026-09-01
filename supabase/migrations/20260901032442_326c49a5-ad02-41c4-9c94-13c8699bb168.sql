
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL;
ALTER TABLE public.chat_group_messages ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.chat_group_messages(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.can_see_chat_message(_scope text, _message_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _scope = 'dm' THEN EXISTS (
      SELECT 1 FROM public.chat_messages m
      WHERE m.id = _message_id AND (m.sender_id = auth.uid() OR m.recipient_id = auth.uid())
    )
    WHEN _scope = 'group' THEN EXISTS (
      SELECT 1 FROM public.chat_group_messages gm
      JOIN public.chat_group_members mem ON mem.group_id = gm.group_id
      WHERE gm.id = _message_id AND mem.user_id = auth.uid()
    )
    ELSE false
  END
$$;
REVOKE ALL ON FUNCTION public.can_see_chat_message(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_chat_message(text, uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.chat_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('dm','group')),
  message_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, message_id, user_id, emoji)
);
CREATE INDEX IF NOT EXISTS chat_reactions_msg_idx ON public.chat_reactions(scope, message_id);

GRANT SELECT, INSERT, DELETE ON public.chat_reactions TO authenticated;
GRANT ALL ON public.chat_reactions TO service_role;
ALTER TABLE public.chat_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reactions_select_visible" ON public.chat_reactions
  FOR SELECT TO authenticated
  USING (public.can_see_chat_message(scope, message_id));

CREATE POLICY "reactions_insert_own" ON public.chat_reactions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_see_chat_message(scope, message_id));

CREATE POLICY "reactions_delete_own" ON public.chat_reactions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_reactions;
