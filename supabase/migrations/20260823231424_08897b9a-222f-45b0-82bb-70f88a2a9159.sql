-- Question images must be viewable by all signed-in learners, but writable
-- only inside the uploader's own folder: q/<uid>/...
CREATE POLICY "makron question assets read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'makron-files' AND (storage.foldername(name))[1] = 'q');

CREATE POLICY "makron question assets write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'makron-files'
    AND (storage.foldername(name))[1] = 'q'
    AND (storage.foldername(name))[2] = (auth.uid())::text
  );

CREATE POLICY "makron question assets delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'makron-files'
    AND (storage.foldername(name))[1] = 'q'
    AND ((storage.foldername(name))[2] = (auth.uid())::text OR public.has_role(auth.uid(),'admin'))
  );