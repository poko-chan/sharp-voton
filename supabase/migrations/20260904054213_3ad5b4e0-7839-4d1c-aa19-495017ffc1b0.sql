DROP POLICY IF EXISTS nb_select ON public.notebooks;
CREATE POLICY nb_select ON public.notebooks FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR public.notebook_can_view(id));

DROP POLICY IF EXISTS nb_update ON public.notebooks;
CREATE POLICY nb_update ON public.notebooks FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id OR public.notebook_can_edit(id))
  WITH CHECK (auth.uid() = owner_id OR public.notebook_can_edit(id));

NOTIFY pgrst, 'reload schema';