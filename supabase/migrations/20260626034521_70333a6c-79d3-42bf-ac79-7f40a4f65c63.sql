
-- 1) Auto-add the creator as owner in organization_members on approval/creation, and backfill existing.
CREATE OR REPLACE FUNCTION public.ensure_org_owner_membership()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.organization_members (organization_id, user_id, role, suspended)
    VALUES (NEW.id, NEW.created_by, 'owner', false)
    ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'owner', suspended = false;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ensure_org_owner ON public.organizations;
CREATE TRIGGER trg_ensure_org_owner AFTER INSERT OR UPDATE OF created_by, status ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.ensure_org_owner_membership();

-- Backfill: any org with no members and a created_by → add owner row
INSERT INTO public.organization_members (organization_id, user_id, role, suspended)
SELECT o.id, o.created_by, 'owner', false
FROM public.organizations o
WHERE o.created_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = o.id AND om.user_id = o.created_by)
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- 2) Make sure system admins can manage/own legacy orgs with NULL created_by by adopting them
-- (no-op without explicit instruction).

-- 3) Allow org admins to edit organization name/description via existing UPDATE policy (already covered).
