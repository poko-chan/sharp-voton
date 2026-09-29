CREATE TABLE IF NOT EXISTS public.parent_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL,
  child_id uuid NOT NULL,
  title text NOT NULL,
  detail text,
  reward_coins integer NOT NULL DEFAULT 50,
  due_date date,
  status text NOT NULL DEFAULT 'open',
  claimed_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parent_missions TO authenticated;
GRANT ALL ON public.parent_missions TO service_role;

ALTER TABLE public.parent_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parent manages missions"
ON public.parent_missions FOR ALL TO authenticated
USING (auth.uid() = parent_id)
WITH CHECK (auth.uid() = parent_id);

CREATE POLICY "child reads own missions"
ON public.parent_missions FOR SELECT TO authenticated
USING (auth.uid() = child_id);

CREATE POLICY "child claims own missions"
ON public.parent_missions FOR UPDATE TO authenticated
USING (auth.uid() = child_id)
WITH CHECK (auth.uid() = child_id);

CREATE INDEX IF NOT EXISTS parent_missions_child_idx ON public.parent_missions (child_id, status);

CREATE TRIGGER parent_missions_updated_at
BEFORE UPDATE ON public.parent_missions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.child_controls
  ADD COLUMN IF NOT EXISTS focus_until timestamptz,
  ADD COLUMN IF NOT EXISTS focus_scope text;