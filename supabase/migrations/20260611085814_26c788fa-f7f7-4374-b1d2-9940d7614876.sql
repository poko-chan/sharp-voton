
CREATE POLICY "makron read all auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'makron-files');
CREATE POLICY "makron admin write" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'makron-files' AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (bucket_id = 'makron-files' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "makron user upload own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'makron-files' AND (storage.foldername(name))[1] = auth.uid()::text);
