DROP POLICY IF EXISTS faq_admin_write ON public.faq_entries;
CREATE POLICY faq_admin_insert ON public.faq_entries FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY faq_admin_update ON public.faq_entries FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY faq_admin_delete ON public.faq_entries FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.faq_entries FROM anon;