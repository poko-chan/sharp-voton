
-- USER RESTRICTIONS
CREATE TABLE public.user_restrictions (
  user_id UUID PRIMARY KEY,
  restricted BOOLEAN NOT NULL DEFAULT false,
  message TEXT,
  restricted_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_restrictions TO authenticated;
GRANT ALL ON public.user_restrictions TO service_role;
ALTER TABLE public.user_restrictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY ur_select_self_or_admin ON public.user_restrictions FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY ur_admin_write ON public.user_restrictions FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_ur_updated_at BEFORE UPDATE ON public.user_restrictions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- FAQ ENTRIES
CREATE TABLE public.faq_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.faq_entries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.faq_entries TO authenticated;
GRANT ALL ON public.faq_entries TO service_role;
ALTER TABLE public.faq_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY faq_public_read ON public.faq_entries FOR SELECT
  USING (published = true OR public.has_role(auth.uid(),'admin'));
CREATE POLICY faq_admin_write ON public.faq_entries FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_faq_updated_at BEFORE UPDATE ON public.faq_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
