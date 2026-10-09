CREATE OR REPLACE FUNCTION public.admin_review_organization_application(_app_id uuid, _approve boolean, _note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.organization_applications%ROWTYPE; new_org uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION '権限がありません'; END IF;
  SELECT * INTO a FROM public.organization_applications WHERE id = _app_id;
  IF a.id IS NULL THEN RAISE EXCEPTION '申請が見つかりません'; END IF;

  IF _approve THEN
    new_org := a.organization_id;
    IF new_org IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = new_org) THEN
      INSERT INTO public.organizations (name, description, status, created_by, owner_id, reviewed_by, reviewed_at)
      VALUES (a.org_name, a.note, 'approved', a.applicant_id, a.applicant_id, auth.uid(), now())
      RETURNING id INTO new_org;
    ELSE
      UPDATE public.organizations SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
        WHERE id = new_org;
    END IF;
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (new_org, a.applicant_id, 'owner')
    ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'owner';
    UPDATE public.organization_applications
      SET status = 'approved', organization_id = new_org, reviewed_by = auth.uid(), reviewed_at = now(),
          admin_note = coalesce(_note, admin_note)
      WHERE id = _app_id;
  ELSE
    new_org := a.organization_id;
    IF new_org IS NOT NULL THEN
      UPDATE public.organizations SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
        WHERE id = new_org;
    END IF;
    UPDATE public.organization_applications
      SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
          admin_note = coalesce(_note, admin_note)
      WHERE id = _app_id;
  END IF;

  INSERT INTO public.organization_application_messages (application_id, sender_id, is_admin, body)
  VALUES (_app_id, auth.uid(), true,
    CASE WHEN _approve THEN '【運営】申請を承認しました。組織ページから利用を開始できます。'
         ELSE '【運営】申請を非承認にしました。' END
    || CASE WHEN coalesce(trim(_note), '') <> '' THEN E'\n' || trim(_note) ELSE '' END);
  RETURN new_org;
END; $$;

REVOKE ALL ON FUNCTION public.admin_review_organization_application(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_review_organization_application(uuid, boolean, text) TO authenticated;