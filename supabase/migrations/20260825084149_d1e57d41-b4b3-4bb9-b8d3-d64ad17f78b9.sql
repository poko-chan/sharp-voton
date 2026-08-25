
-- 1) packs: unit_id nullable, add grade + subject/field links
ALTER TABLE public.makron_packs ALTER COLUMN unit_id DROP NOT NULL;
ALTER TABLE public.makron_packs ADD COLUMN IF NOT EXISTS grade text;
ALTER TABLE public.makron_packs ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.makron_subjects(id) ON DELETE SET NULL;
ALTER TABLE public.makron_packs ADD COLUMN IF NOT EXISTS field_id uuid REFERENCES public.makron_fields(id) ON DELETE SET NULL;
ALTER TABLE public.makron_units ADD COLUMN IF NOT EXISTS grade text;

-- 2) questions: unit_id nullable (packに属する)
ALTER TABLE public.makron_questions ALTER COLUMN unit_id DROP NOT NULL;

-- 3) 公式/承認の廃止
DROP TRIGGER IF EXISTS makron_pack_set_status_trg ON public.makron_packs;
DROP TRIGGER IF EXISTS makron_question_set_status_trg ON public.makron_questions;
ALTER TABLE public.makron_packs ALTER COLUMN status SET DEFAULT 'approved';
ALTER TABLE public.makron_packs ALTER COLUMN is_official SET DEFAULT true;
UPDATE public.makron_packs SET status = 'approved', is_official = true;
ALTER TABLE public.makron_questions ALTER COLUMN status SET DEFAULT 'approved';
UPDATE public.makron_questions SET status = 'approved';

-- 4) RLS: 閲覧は全員、作成/編集/削除は管理者のみ
DROP POLICY IF EXISTS "packs read approved or own or admin" ON public.makron_packs;
DROP POLICY IF EXISTS "packs insert anyone" ON public.makron_packs;
DROP POLICY IF EXISTS "packs update own or admin" ON public.makron_packs;
DROP POLICY IF EXISTS "packs delete own or admin" ON public.makron_packs;

CREATE POLICY "packs select all" ON public.makron_packs FOR SELECT USING (true);
CREATE POLICY "packs admin insert" ON public.makron_packs FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "packs admin update" ON public.makron_packs FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "packs admin delete" ON public.makron_packs FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
