CREATE TABLE public.plan_pack_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pack_id UUID NOT NULL REFERENCES public.plan_packs(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '新しい商品',
  description TEXT,
  price INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'JPY',
  amount_label TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_pack_items TO authenticated;
GRANT SELECT ON public.plan_pack_items TO anon;
GRANT ALL ON public.plan_pack_items TO service_role;
ALTER TABLE public.plan_pack_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ppi_read" ON public.plan_pack_items FOR SELECT USING (active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "ppi_write" ON public.plan_pack_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));