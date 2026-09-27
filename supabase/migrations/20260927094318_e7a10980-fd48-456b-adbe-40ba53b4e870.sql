ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS line_user_id text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_line_user_id_key ON public.profiles(line_user_id) WHERE line_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.line_settings (
  id smallint PRIMARY KEY DEFAULT 1,
  login_channel_id text,
  liff_id text,
  official_account_id text,
  webhook_forward_url text,
  webhook_enabled boolean NOT NULL DEFAULT true,
  welcome_message text,
  apps_script_code text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT line_settings_singleton CHECK (id = 1)
);
GRANT SELECT, INSERT, UPDATE ON public.line_settings TO authenticated;
GRANT ALL ON public.line_settings TO service_role;
ALTER TABLE public.line_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read line settings" ON public.line_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins write line settings" ON public.line_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.line_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.line_pending_links (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id text NOT NULL,
  display_name text,
  picture_url text,
  email text,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '15 minutes',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.line_pending_links TO service_role;
ALTER TABLE public.line_pending_links ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.child_controls (
  child_id uuid PRIMARY KEY,
  daily_limit_minutes integer,
  allowed_from time,
  allowed_to time,
  locked_features text[] NOT NULL DEFAULT '{}',
  homework_first boolean NOT NULL DEFAULT false,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.child_controls TO authenticated;
GRANT ALL ON public.child_controls TO service_role;
ALTER TABLE public.child_controls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "child reads own controls" ON public.child_controls FOR SELECT TO authenticated USING (child_id = auth.uid() OR public.is_parent_of(auth.uid(), child_id));

CREATE TABLE IF NOT EXISTS public.child_login_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL,
  parent_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '90 days',
  revoked boolean NOT NULL DEFAULT false,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.child_login_tokens TO service_role;
ALTER TABLE public.child_login_tokens ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.touch_updated_at_generic()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
DROP TRIGGER IF EXISTS trg_line_settings_updated ON public.line_settings;
CREATE TRIGGER trg_line_settings_updated BEFORE UPDATE ON public.line_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();
DROP TRIGGER IF EXISTS trg_child_controls_updated ON public.child_controls;
CREATE TRIGGER trg_child_controls_updated BEFORE UPDATE ON public.child_controls FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();