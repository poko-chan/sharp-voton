CREATE TABLE IF NOT EXISTS public.material_favorites (
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, material_id)
);
GRANT SELECT, INSERT, DELETE ON public.material_favorites TO authenticated;
GRANT ALL ON public.material_favorites TO service_role;
ALTER TABLE public.material_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own material favorites" ON public.material_favorites FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);