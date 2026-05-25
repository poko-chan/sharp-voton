
CREATE TABLE public.towns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT '私の町',
  town_goal text NOT NULL DEFAULT '',
  stage integer NOT NULL DEFAULT 0,
  max_stage_reached integer NOT NULL DEFAULT 0,
  archived boolean NOT NULL DEFAULT false,
  last_judged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.towns ENABLE ROW LEVEL SECURITY;

CREATE POLICY towns_owner_all ON public.towns FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER towns_set_updated_at
  BEFORE UPDATE ON public.towns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.town_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  town_id uuid NOT NULL REFERENCES public.towns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  stage_before integer NOT NULL,
  stage_after integer NOT NULL,
  delta integer NOT NULL,
  reason text,
  narrative text,
  ai_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.town_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY th_owner_all ON public.town_history FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_towns_user ON public.towns(user_id);
CREATE INDEX idx_town_history_town ON public.town_history(town_id, created_at DESC);
