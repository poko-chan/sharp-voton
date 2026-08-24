-- 1. applications table
CREATE TABLE IF NOT EXISTS public.organization_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_type text NOT NULL CHECK (org_type IN ('school','cram_school','company','club','other')),
  org_type_other text,
  org_name text NOT NULL,
  rep_last_name text NOT NULL,
  rep_first_name text NOT NULL,
  rep_last_kana text,
  rep_first_kana text,
  department text,
  contact_email text NOT NULL,
  contact_phone text,
  country text NOT NULL DEFAULT 'JP',
  prefecture text,
  address text,
  website text,
  expected_users integer,
  note text,
  status public.org_status NOT NULL DEFAULT 'pending',
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.organization_applications TO authenticated;
GRANT UPDATE ON public.organization_applications TO authenticated;
GRANT ALL ON public.organization_applications TO service_role;

ALTER TABLE public.organization_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org apps read own or admin" ON public.organization_applications;
CREATE POLICY "org apps read own or admin" ON public.organization_applications
  FOR SELECT TO authenticated
  USING (applicant_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "org apps insert own" ON public.organization_applications;
CREATE POLICY "org apps insert own" ON public.organization_applications
  FOR INSERT TO authenticated
  WITH CHECK (applicant_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "org apps admin update" ON public.organization_applications;
CREATE POLICY "org apps admin update" ON public.organization_applications
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS org_apps_applicant_idx ON public.organization_applications(applicant_id);
CREATE INDEX IF NOT EXISTS org_apps_status_idx ON public.organization_applications(status);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS update_org_apps_updated_at ON public.organization_applications;
CREATE TRIGGER update_org_apps_updated_at BEFORE UPDATE ON public.organization_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. message thread
CREATE TABLE IF NOT EXISTS public.organization_application_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.organization_applications(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin boolean NOT NULL DEFAULT false,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.organization_application_messages TO authenticated;
GRANT ALL ON public.organization_application_messages TO service_role;

ALTER TABLE public.organization_application_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org app msgs read" ON public.organization_application_messages;
CREATE POLICY "org app msgs read" ON public.organization_application_messages
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.organization_applications a
               WHERE a.id = application_id AND a.applicant_id = auth.uid())
  );

DROP POLICY IF EXISTS "org app msgs insert" ON public.organization_application_messages;
CREATE POLICY "org app msgs insert" ON public.organization_application_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND is_admin = public.has_role(auth.uid(), 'admin')
    AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (SELECT 1 FROM public.organization_applications a
                 WHERE a.id = application_id AND a.applicant_id = auth.uid())
    )
  );

CREATE INDEX IF NOT EXISTS org_app_msgs_app_idx ON public.organization_application_messages(application_id, created_at);

-- 3. submit application
CREATE OR REPLACE FUNCTION public.org_application_submit(_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid; _type text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'ログインが必要です'; END IF;
  _type := coalesce(_payload->>'org_type', '');
  IF _type NOT IN ('school','cram_school','company','club','other') THEN
    RAISE EXCEPTION '種別を選択してください';
  END IF;
  IF coalesce(trim(_payload->>'org_name'), '') = '' THEN RAISE EXCEPTION '組織名を入力してください'; END IF;
  IF coalesce(trim(_payload->>'contact_email'), '') = '' THEN RAISE EXCEPTION 'ご連絡メールアドレスを入力してください'; END IF;
  IF EXISTS (SELECT 1 FROM public.organization_applications
             WHERE applicant_id = auth.uid() AND status = 'pending') THEN
    RAISE EXCEPTION '審査中の申請があります。結果をお待ちください';
  END IF;
  INSERT INTO public.organization_applications (
    applicant_id, org_type, org_type_other, org_name,
    rep_last_name, rep_first_name, rep_last_kana, rep_first_kana,
    department, contact_email, contact_phone, country, prefecture, address,
    website, expected_users, note
  ) VALUES (
    auth.uid(), _type, nullif(trim(coalesce(_payload->>'org_type_other','')),''), trim(_payload->>'org_name'),
    coalesce(nullif(trim(coalesce(_payload->>'rep_last_name','')),''),'-'),
    coalesce(nullif(trim(coalesce(_payload->>'rep_first_name','')),''),'-'),
    nullif(trim(coalesce(_payload->>'rep_last_kana','')),''),
    nullif(trim(coalesce(_payload->>'rep_first_kana','')),''),
    nullif(trim(coalesce(_payload->>'department','')),''),
    trim(_payload->>'contact_email'),
    nullif(trim(coalesce(_payload->>'contact_phone','')),''),
    coalesce(nullif(trim(coalesce(_payload->>'country','')),''),'JP'),
    nullif(trim(coalesce(_payload->>'prefecture','')),''),
    nullif(trim(coalesce(_payload->>'address','')),''),
    nullif(trim(coalesce(_payload->>'website','')),''),
    nullif(_payload->>'expected_users','')::int,
    nullif(trim(coalesce(_payload->>'note','')),'')
  ) RETURNING id INTO new_id;
  RETURN new_id;
END; $$;

REVOKE ALL ON FUNCTION public.org_application_submit(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_application_submit(jsonb) TO authenticated;

-- 4. admin review -> creates org
CREATE OR REPLACE FUNCTION public.admin_review_organization_application(_app_id uuid, _approve boolean, _note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.organization_applications%ROWTYPE; new_org uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION '権限がありません'; END IF;
  SELECT * INTO a FROM public.organization_applications WHERE id = _app_id;
  IF a.id IS NULL THEN RAISE EXCEPTION '申請が見つかりません'; END IF;
  IF a.status <> 'pending' THEN RAISE EXCEPTION 'この申請は既に処理済みです'; END IF;

  IF _approve THEN
    INSERT INTO public.organizations (name, description, status, created_by, owner_id, reviewed_by, reviewed_at)
    VALUES (a.org_name, a.note, 'approved', a.applicant_id, a.applicant_id, auth.uid(), now())
    RETURNING id INTO new_org;
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (new_org, a.applicant_id, 'owner')
    ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'owner';
    UPDATE public.organization_applications
      SET status = 'approved', organization_id = new_org, reviewed_by = auth.uid(), reviewed_at = now(),
          admin_note = coalesce(_note, admin_note)
      WHERE id = _app_id;
  ELSE
    UPDATE public.organization_applications
      SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
          admin_note = coalesce(_note, admin_note)
      WHERE id = _app_id;
  END IF;
  RETURN new_org;
END; $$;

REVOKE ALL ON FUNCTION public.admin_review_organization_application(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_review_organization_application(uuid, boolean, text) TO authenticated;

-- 5. disable direct self-serve org creation
CREATE OR REPLACE FUNCTION public.org_create(_name TEXT, _description TEXT DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION '組織の作成は「学校・塾の方へ」ページの導入申請フォームから行ってください';
END; $$;

DROP POLICY IF EXISTS "org create by anyone" ON public.organizations;