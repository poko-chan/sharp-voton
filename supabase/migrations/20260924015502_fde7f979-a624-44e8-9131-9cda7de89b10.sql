CREATE TABLE public.org_custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  base_role org_role NOT NULL DEFAULT 'member',
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_custom_roles TO authenticated;
GRANT ALL ON public.org_custom_roles TO service_role;
ALTER TABLE public.org_custom_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "custom roles readable by members" ON public.org_custom_roles FOR SELECT TO authenticated
  USING (is_org_member(organization_id, auth.uid()) OR has_role(auth.uid(),'admin'));
CREATE POLICY "custom roles managed by owner" ON public.org_custom_roles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members m WHERE m.organization_id = org_custom_roles.organization_id AND m.user_id = auth.uid() AND m.role = 'owner') OR has_role(auth.uid(),'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM organization_members m WHERE m.organization_id = org_custom_roles.organization_id AND m.user_id = auth.uid() AND m.role = 'owner') OR has_role(auth.uid(),'admin'));
CREATE TRIGGER org_custom_roles_updated BEFORE UPDATE ON public.org_custom_roles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.organization_members ADD COLUMN custom_role_id uuid REFERENCES public.org_custom_roles(id) ON DELETE SET NULL;

-- 所有者だけがメンバーにカスタム権限を割り当てる（基本権限も連動）
CREATE OR REPLACE FUNCTION public.org_assign_custom_role(_org uuid, _user uuid, _role uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r org_custom_roles;
BEGIN
  IF NOT (EXISTS (SELECT 1 FROM organization_members WHERE organization_id=_org AND user_id=auth.uid() AND role='owner') OR has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION '所有者のみ変更できます';
  END IF;
  IF EXISTS (SELECT 1 FROM organization_members WHERE organization_id=_org AND user_id=_user AND role='owner') THEN
    RAISE EXCEPTION '所有者の権限は変更できません';
  END IF;
  IF _role IS NULL THEN
    UPDATE organization_members SET custom_role_id=NULL, role='member' WHERE organization_id=_org AND user_id=_user;
    RETURN;
  END IF;
  SELECT * INTO r FROM org_custom_roles WHERE id=_role AND organization_id=_org;
  IF r.id IS NULL THEN RAISE EXCEPTION '権限が見つかりません'; END IF;
  UPDATE organization_members SET custom_role_id=r.id, role=CASE WHEN r.base_role='owner' THEN 'admin'::org_role ELSE r.base_role END
  WHERE organization_id=_org AND user_id=_user;
END $$;
REVOKE EXECUTE ON FUNCTION public.org_assign_custom_role(uuid,uuid,uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.org_assign_custom_role(uuid,uuid,uuid) TO authenticated;