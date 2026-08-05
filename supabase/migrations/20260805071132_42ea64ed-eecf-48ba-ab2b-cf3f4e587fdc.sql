
-- 1. GRANTS (missing: this is why organizations were unusable)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_join_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_invitations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_service_restrictions TO authenticated;
GRANT ALL ON public.organizations TO service_role;
GRANT ALL ON public.organization_members TO service_role;
GRANT ALL ON public.organization_join_requests TO service_role;
GRANT ALL ON public.organization_invitations TO service_role;
GRANT ALL ON public.organization_service_restrictions TO service_role;

-- 2. columns
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS join_code TEXT,
  ADD COLUMN IF NOT EXISTS owner_id UUID,
  ADD COLUMN IF NOT EXISTS share_study_time BOOLEAN NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.gen_org_join_code()
RETURNS TEXT LANGUAGE plpgsql SET search_path = public AS $$
DECLARE c TEXT;
BEGIN
  LOOP
    c := upper(substr(md5(gen_random_uuid()::text), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.organizations WHERE join_code = c);
  END LOOP;
  RETURN c;
END; $$;

UPDATE public.organizations SET join_code = public.gen_org_join_code() WHERE join_code IS NULL;
UPDATE public.organizations SET owner_id = created_by WHERE owner_id IS NULL;
ALTER TABLE public.organizations ALTER COLUMN join_code SET DEFAULT public.gen_org_join_code();
CREATE UNIQUE INDEX IF NOT EXISTS organizations_join_code_key ON public.organizations(join_code);

ALTER TABLE public.makron_packs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "packs org members read" ON public.makron_packs;
CREATE POLICY "packs org members read" ON public.makron_packs FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND public.is_org_member(organization_id, auth.uid()));
DROP POLICY IF EXISTS "classes org members read" ON public.classes;
CREATE POLICY "classes org members read" ON public.classes FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND public.is_org_member(organization_id, auth.uid()));

-- 3. everyone may see basic info of an approved org by code (needed for join flow)
DROP POLICY IF EXISTS "org create by anyone" ON public.organizations;
CREATE POLICY "org create by anyone" ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- 4. create org (anyone) -> pending, creator becomes owner
CREATE OR REPLACE FUNCTION public.org_create(_name TEXT, _description TEXT DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'ログインが必要です'; END IF;
  IF coalesce(trim(_name), '') = '' THEN RAISE EXCEPTION '組織名を入力してください'; END IF;
  INSERT INTO public.organizations (name, description, status, created_by, owner_id)
  VALUES (trim(_name), nullif(trim(coalesce(_description,'')), ''), 'pending', auth.uid(), auth.uid())
  RETURNING id INTO new_id;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_id, auth.uid(), 'owner')
  ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'owner';
  RETURN new_id;
END; $$;

-- 5. join by code
CREATE OR REPLACE FUNCTION public.org_join_by_code(_code TEXT)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.organizations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'ログインが必要です'; END IF;
  SELECT * INTO o FROM public.organizations WHERE join_code = upper(trim(_code));
  IF NOT FOUND THEN RAISE EXCEPTION '参加コードが見つかりません'; END IF;
  IF o.status <> 'approved' THEN RAISE EXCEPTION 'この組織はまだ運営に承認されていません'; END IF;
  IF EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = o.id AND user_id = auth.uid())
    THEN RAISE EXCEPTION 'すでに参加しています'; END IF;
  INSERT INTO public.organization_join_requests (organization_id, user_id, status)
  VALUES (o.id, auth.uid(), 'pending')
  ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'pending', created_at = now(), reviewed_at = NULL, reviewed_by = NULL;
  RETURN o.id;
END; $$;

-- 6. transfer ownership (owner only)
CREATE OR REPLACE FUNCTION public.org_transfer_ownership(_org UUID, _user UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = _org AND owner_id = auth.uid())
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION '経営者のみ権限を移譲できます';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = _org AND user_id = _user) THEN
    RAISE EXCEPTION '対象ユーザーは組織メンバーではありません';
  END IF;
  UPDATE public.organization_members SET role = 'admin'
    WHERE organization_id = _org AND role = 'owner';
  UPDATE public.organization_members SET role = 'owner'
    WHERE organization_id = _org AND user_id = _user;
  UPDATE public.organizations SET owner_id = _user, updated_at = now() WHERE id = _org;
END; $$;

-- 7. member study stats for org admins
CREATE OR REPLACE FUNCTION public.org_member_stats(_org UUID)
RETURNS TABLE (user_id UUID, username TEXT, display_name TEXT, role public.org_role,
               minutes_7d BIGINT, minutes_30d BIGINT, sessions_30d BIGINT, last_studied TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_org_admin(_org, auth.uid()) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION '権限がありません';
  END IF;
  RETURN QUERY
  SELECT m.user_id, p.username, p.display_name, m.role,
    coalesce(sum(l.duration_minutes) FILTER (WHERE l.studied_at >= now() - interval '7 days'), 0)::bigint,
    coalesce(sum(l.duration_minutes) FILTER (WHERE l.studied_at >= now() - interval '30 days'), 0)::bigint,
    count(l.id) FILTER (WHERE l.studied_at >= now() - interval '30 days')::bigint,
    max(l.studied_at)
  FROM public.organization_members m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  LEFT JOIN public.study_logs l ON l.user_id = m.user_id
  WHERE m.organization_id = _org
  GROUP BY m.user_id, p.username, p.display_name, m.role
  ORDER BY 5 DESC;
END; $$;

-- 8. force-enroll all org members into an org class
CREATE OR REPLACE FUNCTION public.org_enroll_all(_org UUID, _class UUID)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT (public.is_org_admin(_org, auth.uid()) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION '権限がありません';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = _class AND organization_id = _org) THEN
    RAISE EXCEPTION 'この組織のクラスではありません';
  END IF;
  WITH ins AS (
    INSERT INTO public.class_members (class_id, user_id, role)
    SELECT _class, m.user_id, CASE WHEN m.role IN ('owner','admin','teacher') THEN 'teacher' ELSE 'student' END
    FROM public.organization_members m
    WHERE m.organization_id = _org
    ON CONFLICT (class_id, user_id) DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO n FROM ins;
  RETURN n;
END; $$;

GRANT EXECUTE ON FUNCTION public.org_create(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_join_by_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_transfer_ownership(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_member_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_enroll_all(UUID, UUID) TO authenticated;
