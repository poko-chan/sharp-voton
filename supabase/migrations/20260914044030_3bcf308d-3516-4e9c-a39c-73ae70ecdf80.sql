DROP POLICY IF EXISTS "members read own org" ON public.organization_members;
CREATE POLICY "members read own org" ON public.organization_members
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR is_org_staff(organization_id, auth.uid())
  OR is_org_admin(organization_id, auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);