DROP POLICY IF EXISTS "custom roles managed by owner" ON public.org_custom_roles;
CREATE POLICY "custom roles managed by owner" ON public.org_custom_roles FOR ALL TO authenticated
USING (public.is_org_admin(organization_id, auth.uid()) OR has_role(auth.uid(),'admin'))
WITH CHECK (public.is_org_admin(organization_id, auth.uid()) OR has_role(auth.uid(),'admin'));