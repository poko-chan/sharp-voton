
-- Tutor threads
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

ALTER TABLE public.tutor_messages ADD COLUMN IF NOT EXISTS thread_id uuid;
CREATE INDEX IF NOT EXISTS idx_tm_thread ON public.tutor_messages(thread_id, created_at);

-- Backfill: create one "過去ログ" thread per user with existing messages, assign all their messages to it
DO $$
DECLARE r record; new_id uuid;
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM public.tutor_messages WHERE thread_id IS NULL LOOP
    INSERT INTO public.tutor_threads (user_id, title) VALUES (r.user_id, '過去ログ') RETURNING id INTO new_id;
    UPDATE public.tutor_messages SET thread_id = new_id WHERE user_id = r.user_id AND thread_id IS NULL;
  END LOOP;
END $$;

-- Chat messages enhancements
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

DROP POLICY IF EXISTS chat_update_own ON public.chat_messages;
CREATE POLICY chat_update_own ON public.chat_messages FOR UPDATE
  USING ((auth.uid() = sender_id) OR (auth.uid() = recipient_id) OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK ((auth.uid() = sender_id) OR (auth.uid() = recipient_id) OR has_role(auth.uid(),'admin'::app_role));

DROP POLICY IF EXISTS chat_delete_own ON public.chat_messages;
CREATE POLICY chat_delete_own ON public.chat_messages FOR DELETE
  USING ((auth.uid() = sender_id) OR has_role(auth.uid(),'admin'::app_role));

DROP POLICY IF EXISTS chat_select_participants ON public.chat_messages;
CREATE POLICY chat_select_participants ON public.chat_messages FOR SELECT
  USING ((auth.uid() = sender_id) OR (auth.uid() = recipient_id) OR has_role(auth.uid(),'admin'::app_role));

-- Coins
CREATE TABLE public.user_coins (
  user_id uuid PRIMARY KEY,
  balance integer NOT NULL DEFAULT 0,
  total_earned integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_coins ENABLE ROW LEVEL SECURITY;
CREATE POLICY uc_owner ON public.user_coins FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Town items
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

-- Town events (for stagnation log)
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
