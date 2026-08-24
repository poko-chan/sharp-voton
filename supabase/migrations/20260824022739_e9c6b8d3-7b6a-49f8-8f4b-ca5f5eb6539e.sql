-- Materials: everyone can see approved + pending (pending shown as 非公式); rejected only to owner/admin
DROP POLICY IF EXISTS materials_read ON public.materials;
CREATE POLICY materials_read ON public.materials FOR SELECT TO authenticated
  USING (
    status IN ('approved','pending')
    OR created_by = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE OR REPLACE FUNCTION public.admin_review_material(_id uuid, _approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION '管理者のみ実行できます'; END IF;
  UPDATE public.materials
    SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
        approved_by = auth.uid(), approved_at = now(), updated_at = now()
  WHERE id = _id;
END $$;
REVOKE ALL ON FUNCTION public.admin_review_material(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_material(uuid, boolean) TO authenticated;

-- Apply or reject a proposed edit (patch is a jsonb of column -> value)
CREATE OR REPLACE FUNCTION public.admin_review_material_edit(_id uuid, _approve boolean, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v RECORD; k text; allowed text[] := ARRAY[
  'title','subtitle','isbn','barcode','subject','sub_subject','publisher','author','edition','year',
  'pages','level','difficulty','target_grade','target_exam','category','format','language','cover_url',
  'description','tags','price','recommend_for','table_of_contents','series','volume','url'];
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION '管理者のみ実行できます'; END IF;
  SELECT * INTO v FROM public.material_edits WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION '申請が見つかりません'; END IF;
  IF v.status <> 'pending' THEN RAISE EXCEPTION '既に処理済みです'; END IF;

  IF _approve THEN
    FOR k IN SELECT jsonb_object_keys(v.patch) LOOP
      IF k = ANY(allowed) THEN
        EXECUTE format('UPDATE public.materials SET %I = ($1->>%L) WHERE id = $2', k, k)
          USING v.patch, v.material_id;
      END IF;
    END LOOP;
    UPDATE public.materials SET updated_at = now() WHERE id = v.material_id;
  END IF;

  UPDATE public.material_edits
    SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
        reviewed_by = auth.uid(), reviewed_at = now(), note = COALESCE(_note, note)
  WHERE id = _id;
END $$;
REVOKE ALL ON FUNCTION public.admin_review_material_edit(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_material_edit(uuid, boolean, text) TO authenticated;