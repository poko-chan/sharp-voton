CREATE POLICY "ambient own read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'ambient-audio' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "ambient own insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ambient-audio' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "ambient own delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'ambient-audio' AND auth.uid()::text = (storage.foldername(name))[1]);