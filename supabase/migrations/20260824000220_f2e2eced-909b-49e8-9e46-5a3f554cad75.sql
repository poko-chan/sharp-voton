DROP POLICY IF EXISTS faq_public_read ON public.faq_entries;
CREATE POLICY faq_anon_read ON public.faq_entries FOR SELECT TO anon USING (published = true);
CREATE POLICY faq_auth_read ON public.faq_entries FOR SELECT TO authenticated USING (published = true OR public.has_role(auth.uid(), 'admin'::app_role));
GRANT SELECT ON public.faq_entries TO anon;
GRANT SELECT ON public.faq_entries TO authenticated;