ALTER TABLE public.plan_features
  DROP CONSTRAINT IF EXISTS plan_features_kind_check;

ALTER TABLE public.plan_features
  ADD CONSTRAINT plan_features_kind_check
  CHECK (kind IN ('bool', 'tri', 'quad', 'stars', 'custom', 'text'));

ALTER TABLE public.plan_features
  ADD COLUMN IF NOT EXISTS options jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS show_check boolean NOT NULL DEFAULT true;