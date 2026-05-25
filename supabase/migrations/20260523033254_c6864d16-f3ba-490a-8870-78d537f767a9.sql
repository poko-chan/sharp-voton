
CREATE TABLE IF NOT EXISTS public.feedback_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES public.feedback(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('user','admin')),
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_messages_feedback ON public.feedback_messages(feedback_id, created_at);

ALTER TABLE public.feedback_messages ENABLE ROW LEVEL SECURITY;

-- Users can read messages in their own feedback threads
CREATE POLICY "Users read own thread messages"
ON public.feedback_messages FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.feedback f WHERE f.id = feedback_id AND f.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

-- Users can insert messages in their own threads; admins can insert in any
CREATE POLICY "Users insert own thread messages"
ON public.feedback_messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND (
    (sender_role = 'user' AND EXISTS (SELECT 1 FROM public.feedback f WHERE f.id = feedback_id AND f.user_id = auth.uid()))
    OR (sender_role = 'admin' AND public.has_role(auth.uid(), 'admin'))
  )
);

-- Mark read by recipient
CREATE POLICY "Users update read_at on their threads"
ON public.feedback_messages FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.feedback f WHERE f.id = feedback_id AND f.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);
