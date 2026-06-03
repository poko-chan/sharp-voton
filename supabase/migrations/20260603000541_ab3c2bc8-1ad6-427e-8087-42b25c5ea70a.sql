
-- Sticky notes
CREATE TABLE public.sticky_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT 'yellow',
  x integer NOT NULL DEFAULT 40,
  y integer NOT NULL DEFAULT 40,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sticky_notes TO authenticated;
GRANT ALL ON public.sticky_notes TO service_role;
ALTER TABLE public.sticky_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY sn_owner_all ON public.sticky_notes FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER sn_updated BEFORE UPDATE ON public.sticky_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Class group chat
CREATE TABLE public.class_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  body text NOT NULL,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_chat_messages TO authenticated;
GRANT ALL ON public.class_chat_messages TO service_role;
ALTER TABLE public.class_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY ccm_select ON public.class_chat_messages FOR SELECT
  USING (public.is_class_member(class_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY ccm_insert ON public.class_chat_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid() AND public.is_class_member(class_id, auth.uid()));
CREATE POLICY ccm_update ON public.class_chat_messages FOR UPDATE
  USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());
CREATE POLICY ccm_delete ON public.class_chat_messages FOR DELETE
  USING (sender_id = auth.uid() OR public.is_class_teacher(class_id, auth.uid()));
CREATE INDEX ccm_class_created_idx ON public.class_chat_messages(class_id, created_at DESC);

-- Theme preference on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'default';
