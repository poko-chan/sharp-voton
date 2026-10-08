ALTER TABLE public.plan_features DROP CONSTRAINT IF EXISTS plan_features_kind_check;
ALTER TABLE public.plan_features ADD CONSTRAINT plan_features_kind_check CHECK (kind IN ('bool','tri','quad','stars','custom','text'));
ALTER TABLE public.plan_features
  ADD COLUMN IF NOT EXISTS options jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS show_check boolean NOT NULL DEFAULT true;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS sub_group text;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS tagline text;
CREATE TABLE IF NOT EXISTS public.plan_faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL DEFAULT '',
  answer text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plan_faqs TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.plan_faqs TO authenticated;
GRANT ALL ON public.plan_faqs TO service_role;
ALTER TABLE public.plan_faqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View active plan faqs" ON public.plan_faqs FOR SELECT USING (active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage plan faqs" ON public.plan_faqs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
NOTIFY pgrst, 'reload schema';