DROP POLICY IF EXISTS "makron question assets read" ON storage.objects;
CREATE POLICY "makron question assets read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'makron-files'
  AND (storage.foldername(name))[1] = 'q'
  AND (
    owner_id = (select auth.uid())::text
    OR public.has_role((select auth.uid()), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.makron_questions mq
      WHERE mq.image_url LIKE '%' || storage.objects.name
        AND (mq.status = 'approved' OR mq.created_by = (select auth.uid()))
    )
  )
);