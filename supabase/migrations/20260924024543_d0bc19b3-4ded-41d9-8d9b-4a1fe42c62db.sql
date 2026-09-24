DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('service_restrictions','sr_read_all'),('app_settings','settings_read_auth'),
    ('makron_subjects','subjects readable'),('makron_fields','fields readable'),
    ('badges','read badges'),('daily_three','read daily three'),('unit_roadmap','read roadmap'),
    ('makron_daily_sets','daily sets readable'),('makron_units','mu_select'),
    ('plan_template_marketplace','read all plan templates')) AS t(tbl,pol)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.pol, r.tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL)', r.pol, r.tbl);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (owner_id = (select auth.uid()::text) OR public.has_role(auth.uid(),'admin')));

DROP POLICY IF EXISTS "makron question assets read" ON storage.objects;
CREATE POLICY "makron question assets read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'makron-files' AND (storage.foldername(name))[1] = 'q' AND (
    owner_id = (select auth.uid()::text)
    OR public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.makron_questions mq WHERE mq.image_url LIKE '%' || storage.objects.name)
  ));