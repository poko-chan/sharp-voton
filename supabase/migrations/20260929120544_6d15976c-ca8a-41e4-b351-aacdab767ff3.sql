ALTER TABLE public.line_settings
  ADD COLUMN IF NOT EXISTS auto_replies jsonb NOT NULL DEFAULT '[]'::jsonb;