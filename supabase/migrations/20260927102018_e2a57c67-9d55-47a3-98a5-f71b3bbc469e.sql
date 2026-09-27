-- 1) child_controls 拡張
ALTER TABLE public.child_controls
  ADD COLUMN IF NOT EXISTS always_allowed_features text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS app_time_limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS bonus_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_date date;

-- 2) 親子メッセージ
CREATE TABLE IF NOT EXISTS public.parent_child_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL,
  child_id uuid NOT NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('parent','child')),
  kind text NOT NULL DEFAULT 'text' CHECK (kind IN ('text','sticker')),
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pcm_child_idx ON public.parent_child_messages (child_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pcm_parent_idx ON public.parent_child_messages (parent_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.parent_child_messages TO authenticated;
GRANT ALL ON public.parent_child_messages TO service_role;
ALTER TABLE public.parent_child_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pcm read own" ON public.parent_child_messages
  FOR SELECT TO authenticated
  USING (auth.uid() = parent_id OR auth.uid() = child_id);
CREATE POLICY "pcm insert own" ON public.parent_child_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    (sender_role = 'parent' AND auth.uid() = parent_id)
    OR (sender_role = 'child' AND auth.uid() = child_id)
  );
CREATE POLICY "pcm mark read" ON public.parent_child_messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = parent_id OR auth.uid() = child_id)
  WITH CHECK (auth.uid() = parent_id OR auth.uid() = child_id);

-- 3) 利用延長リクエスト
CREATE TABLE IF NOT EXISTS public.child_extension_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL,
  parent_id uuid NOT NULL,
  minutes integer NOT NULL CHECK (minutes > 0 AND minutes <= 240),
  reason text,
  scope text NOT NULL DEFAULT 'all',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  granted_minutes integer,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cer_child_idx ON public.child_extension_requests (child_id, created_at DESC);
CREATE INDEX IF NOT EXISTS cer_parent_idx ON public.child_extension_requests (parent_id, status);
GRANT SELECT, INSERT, UPDATE ON public.child_extension_requests TO authenticated;
GRANT ALL ON public.child_extension_requests TO service_role;
ALTER TABLE public.child_extension_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cer read own" ON public.child_extension_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = parent_id OR auth.uid() = child_id);
CREATE POLICY "cer child insert" ON public.child_extension_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = child_id AND status = 'pending');
CREATE POLICY "cer parent decide" ON public.child_extension_requests
  FOR UPDATE TO authenticated
  USING (auth.uid() = parent_id)
  WITH CHECK (auth.uid() = parent_id);

-- 4) LINE 通知設定
CREATE TABLE IF NOT EXISTS public.user_line_preferences (
  user_id uuid PRIMARY KEY,
  reminder_enabled boolean NOT NULL DEFAULT false,
  reminder_weekday_time text NOT NULL DEFAULT '19:00',
  reminder_weekend_time text NOT NULL DEFAULT '10:00',
  reminder_days integer[] NOT NULL DEFAULT '{1,2,3,4,5,6,0}',
  reminder_tone text NOT NULL DEFAULT 'gentle' CHECK (reminder_tone IN ('gentle','strict','plain')),
  homework_alert_24h boolean NOT NULL DEFAULT true,
  homework_alert_3h boolean NOT NULL DEFAULT true,
  daily_report_enabled boolean NOT NULL DEFAULT false,
  daily_report_time text NOT NULL DEFAULT '21:30',
  weekly_report_enabled boolean NOT NULL DEFAULT false,
  forward_app_notifications boolean NOT NULL DEFAULT false,
  test_countdown_enabled boolean NOT NULL DEFAULT true,
  quiet_enabled boolean NOT NULL DEFAULT true,
  quiet_from text NOT NULL DEFAULT '22:00',
  quiet_to text NOT NULL DEFAULT '07:00',
  security_login_alert boolean NOT NULL DEFAULT true,
  parent_finish_report boolean NOT NULL DEFAULT true,
  parent_extension_request boolean NOT NULL DEFAULT true,
  last_reminder_sent_on date,
  last_daily_report_on date,
  last_weekly_report_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_line_preferences TO authenticated;
GRANT ALL ON public.user_line_preferences TO service_role;
ALTER TABLE public.user_line_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ulp own" ON public.user_line_preferences
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS ulp_updated_at ON public.user_line_preferences;
CREATE TRIGGER ulp_updated_at BEFORE UPDATE ON public.user_line_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();