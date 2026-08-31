DROP POLICY IF EXISTS "all read difficulty" ON public.difficulty_adjustments;
CREATE POLICY "difficulty_admin_read" ON public.difficulty_adjustments
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "materials_read" ON public.materials;
CREATE POLICY "materials_read" ON public.materials
FOR SELECT TO authenticated
USING (
  status = 'approved'
  OR created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

REVOKE EXECUTE ON FUNCTION public.makron_finalize_daily(uuid) FROM authenticated;