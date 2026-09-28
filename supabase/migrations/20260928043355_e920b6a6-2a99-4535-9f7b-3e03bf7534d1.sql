CREATE TABLE public.user_chat_webhooks (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  discord_url text,
  slack_url text,
  notify_study_finished boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_chat_webhooks TO authenticated;
GRANT ALL ON public.user_chat_webhooks TO service_role;
ALTER TABLE public.user_chat_webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own webhooks" ON public.user_chat_webhooks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);