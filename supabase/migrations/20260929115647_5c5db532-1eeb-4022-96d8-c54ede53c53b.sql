CREATE TABLE public.line_message_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction text NOT NULL DEFAULT 'in',
  event_type text,
  line_user_id text,
  user_id uuid,
  message_type text,
  text text,
  ok boolean,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.line_message_logs TO authenticated;
GRANT ALL ON public.line_message_logs TO service_role;
ALTER TABLE public.line_message_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read line logs" ON public.line_message_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX line_message_logs_created_idx ON public.line_message_logs (created_at DESC);
CREATE INDEX line_message_logs_line_user_idx ON public.line_message_logs (line_user_id);