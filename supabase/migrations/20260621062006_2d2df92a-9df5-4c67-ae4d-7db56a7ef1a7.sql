
-- 1) makron_answers: review_flag + is_correct (used by existing code)
ALTER TABLE public.makron_answers ADD COLUMN IF NOT EXISTS review_flag boolean NOT NULL DEFAULT false;
ALTER TABLE public.makron_answers ADD COLUMN IF NOT EXISTS is_correct boolean;
ALTER TABLE public.makron_answers ADD COLUMN IF NOT EXISTS graded_at timestamptz;
ALTER TABLE public.makron_answers ADD COLUMN IF NOT EXISTS graded_by uuid;

-- 2) JST helper
CREATE OR REPLACE FUNCTION public.current_jst_date()
RETURNS date LANGUAGE sql STABLE AS $$
  SELECT (now() AT TIME ZONE 'Asia/Tokyo')::date
$$;

-- 3) Friend-only DM RPC
CREATE OR REPLACE FUNCTION public.send_dm(_to uuid, _content text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid;
BEGIN
  IF auth.uid() IS NULL OR _to IS NULL OR _to = auth.uid() THEN RAISE EXCEPTION '不正な宛先'; END IF;
  IF NOT public.are_mutual_friends(auth.uid(), _to) THEN RAISE EXCEPTION 'フレンドのみ送信可能'; END IF;
  IF _content IS NULL OR length(trim(_content))=0 THEN RAISE EXCEPTION '本文が空です'; END IF;
  INSERT INTO public.chat_messages(sender_id, recipient_id, content)
  VALUES (auth.uid(), _to, _content) RETURNING id INTO v;
  RETURN v;
END $$;

-- 4) Weakness practice session (incorrect-only)
CREATE OR REPLACE FUNCTION public.makron_start_weakness_session(_unit_id uuid, _limit integer DEFAULT 10)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_session uuid; v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.makron_sessions(user_id, unit_id, all_mode)
    VALUES (v_user, _unit_id, false) RETURNING id INTO v_session;
  RETURN v_session;
END $$;

-- Returns recent wrong-answer questions for the user
CREATE OR REPLACE FUNCTION public.makron_weakness_questions(_unit_id uuid, _limit integer DEFAULT 10)
RETURNS SETOF public.makron_questions LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT q.* FROM public.makron_questions q
  WHERE q.is_active = true
    AND (_unit_id IS NULL OR q.unit_id = _unit_id)
    AND q.id IN (
      SELECT DISTINCT a.question_id FROM public.makron_answers a
      JOIN public.makron_sessions s ON s.id = a.session_id
      WHERE s.user_id = auth.uid()
        AND (a.is_correct = false OR (a.auto_correct = false AND a.is_correct IS NULL))
    )
  ORDER BY random()
  LIMIT GREATEST(1, LEAST(50, COALESCE(_limit,10)))
$$;

-- 5) Admin request chat (separate from feedback)
CREATE TABLE IF NOT EXISTS public.admin_request_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  sort_order int NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_request_categories TO authenticated, anon;
GRANT ALL ON public.admin_request_categories TO service_role;
ALTER TABLE public.admin_request_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read categories" ON public.admin_request_categories FOR SELECT USING (is_active);
CREATE POLICY "admin manage categories" ON public.admin_request_categories FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.admin_request_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category_id uuid REFERENCES public.admin_request_categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.admin_request_threads TO authenticated;
GRANT ALL ON public.admin_request_threads TO service_role;
ALTER TABLE public.admin_request_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner or admin read thread" ON public.admin_request_threads FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "user create own thread" ON public.admin_request_threads FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner or admin update thread" ON public.admin_request_threads FOR UPDATE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.admin_request_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.admin_request_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  is_admin boolean NOT NULL DEFAULT false,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_request_messages TO authenticated;
GRANT ALL ON public.admin_request_messages TO service_role;
ALTER TABLE public.admin_request_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "thread participants read" ON public.admin_request_messages FOR SELECT USING (
  EXISTS(SELECT 1 FROM public.admin_request_threads t WHERE t.id=thread_id
    AND (t.user_id=auth.uid() OR public.has_role(auth.uid(),'admin')))
);
CREATE POLICY "thread participants send" ON public.admin_request_messages FOR INSERT WITH CHECK (
  sender_id = auth.uid() AND EXISTS(SELECT 1 FROM public.admin_request_threads t WHERE t.id=thread_id
    AND (t.user_id=auth.uid() OR public.has_role(auth.uid(),'admin')))
);

-- bump last_message_at on insert
CREATE OR REPLACE FUNCTION public.admin_request_touch_thread()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.admin_request_threads SET last_message_at = now() WHERE id = NEW.thread_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_admin_request_touch ON public.admin_request_messages;
CREATE TRIGGER trg_admin_request_touch AFTER INSERT ON public.admin_request_messages
  FOR EACH ROW EXECUTE FUNCTION public.admin_request_touch_thread();

-- seed default categories (idempotent)
INSERT INTO public.admin_request_categories(name, description, sort_order) VALUES
  ('機能要望', '新機能の提案・改善要望', 10),
  ('不具合報告', '動作のおかしい点', 20),
  ('質問', '使い方の質問', 30),
  ('その他', 'その他お問い合わせ', 999)
ON CONFLICT (name) DO NOTHING;
