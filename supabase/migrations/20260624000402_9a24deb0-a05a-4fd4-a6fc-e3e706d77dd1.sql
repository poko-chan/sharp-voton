
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Makron type CHECK 解除
DO $$ BEGIN
  BEGIN ALTER TABLE public.makron_questions DROP CONSTRAINT IF EXISTS makron_questions_type_check;
  EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- materials
CREATE TABLE IF NOT EXISTS public.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL, subtitle TEXT, isbn TEXT, barcode TEXT,
  subject TEXT, sub_subject TEXT, publisher TEXT, author TEXT,
  edition TEXT, year INT, pages INT, level TEXT, difficulty INT,
  target_grade TEXT, target_exam TEXT, category TEXT, format TEXT,
  language TEXT DEFAULT 'ja', cover_url TEXT, description TEXT,
  tags TEXT[] DEFAULT '{}', price INT, recommend_for TEXT,
  table_of_contents TEXT, series TEXT, volume TEXT, url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by UUID, approved_by UUID, approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_materials_status ON public.materials(status);
CREATE INDEX IF NOT EXISTS idx_materials_isbn ON public.materials(isbn);
CREATE INDEX IF NOT EXISTS idx_materials_barcode ON public.materials(barcode);
CREATE INDEX IF NOT EXISTS idx_materials_subject ON public.materials(subject);
CREATE INDEX IF NOT EXISTS idx_materials_title_trgm ON public.materials USING gin (title gin_trgm_ops);

CREATE TABLE IF NOT EXISTS public.material_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  proposer UUID, patch JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID, reviewed_at TIMESTAMPTZ, note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_material_edits_material ON public.material_edits(material_id);
CREATE INDEX IF NOT EXISTS idx_material_edits_status ON public.material_edits(status);

CREATE TABLE IF NOT EXISTS public.material_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  reporter UUID, reason TEXT NOT NULL, detail TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.materials TO anon;
GRANT SELECT, INSERT, UPDATE ON public.materials TO authenticated;
GRANT ALL ON public.materials TO service_role;
GRANT SELECT, INSERT ON public.material_edits TO authenticated;
GRANT ALL ON public.material_edits TO service_role;
GRANT SELECT, INSERT ON public.material_reports TO authenticated;
GRANT ALL ON public.material_reports TO service_role;

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "materials_read" ON public.materials;
CREATE POLICY "materials_read" ON public.materials FOR SELECT
  USING (status = 'approved' OR auth.uid() = created_by OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "materials_insert" ON public.materials;
CREATE POLICY "materials_insert" ON public.materials FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "materials_update" ON public.materials;
CREATE POLICY "materials_update" ON public.materials FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR (auth.uid() = created_by AND status = 'pending'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR (auth.uid() = created_by AND status = 'pending'));

DROP POLICY IF EXISTS "edits_view" ON public.material_edits;
CREATE POLICY "edits_view" ON public.material_edits FOR SELECT
  USING (auth.uid() = proposer OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "edits_insert" ON public.material_edits;
CREATE POLICY "edits_insert" ON public.material_edits FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = proposer);

DROP POLICY IF EXISTS "reports_view" ON public.material_reports;
CREATE POLICY "reports_view" ON public.material_reports FOR SELECT
  USING (public.has_role(auth.uid(),'admin') OR auth.uid() = reporter);
DROP POLICY IF EXISTS "reports_insert" ON public.material_reports;
CREATE POLICY "reports_insert" ON public.material_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter);

CREATE OR REPLACE FUNCTION public.materials_auto_approve()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  IF NEW.status IS NULL OR NEW.status = 'pending' THEN
    IF public.has_role(auth.uid(),'admin') THEN
      NEW.status := 'approved';
      NEW.approved_by := auth.uid();
      NEW.approved_at := now();
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_materials_auto_approve ON public.materials;
CREATE TRIGGER trg_materials_auto_approve BEFORE INSERT ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.materials_auto_approve();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_materials_updated ON public.materials;
CREATE TRIGGER trg_materials_updated BEFORE UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.review_material_edit(_edit_id UUID, _approve BOOLEAN, _note TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e RECORD; k TEXT; v JSONB; sql_text TEXT;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION '管理者のみ'; END IF;
  SELECT * INTO e FROM public.material_edits WHERE id = _edit_id;
  IF NOT FOUND THEN RAISE EXCEPTION '見つかりません'; END IF;
  IF _approve THEN
    FOR k, v IN SELECT * FROM jsonb_each(e.patch) LOOP
      IF k = ANY (ARRAY['title','subtitle','isbn','barcode','subject','sub_subject','publisher','author','edition','year','pages','level','difficulty','target_grade','target_exam','category','format','language','cover_url','description','tags','price','recommend_for','table_of_contents','series','volume','url']) THEN
        sql_text := format('UPDATE public.materials SET %I = $1, updated_at = now() WHERE id = $2', k);
        EXECUTE sql_text USING (CASE WHEN jsonb_typeof(v)='string' THEN v#>>'{}' ELSE v::text END), e.material_id;
      END IF;
    END LOOP;
    UPDATE public.material_edits SET status='approved', reviewed_by=auth.uid(), reviewed_at=now(), note=_note WHERE id=_edit_id;
  ELSE
    UPDATE public.material_edits SET status='rejected', reviewed_by=auth.uid(), reviewed_at=now(), note=_note WHERE id=_edit_id;
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;
GRANT EXECUTE ON FUNCTION public.review_material_edit(UUID, BOOLEAN, TEXT) TO authenticated;

ALTER TABLE public.study_logs ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES public.materials(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_study_logs_material ON public.study_logs(material_id);
