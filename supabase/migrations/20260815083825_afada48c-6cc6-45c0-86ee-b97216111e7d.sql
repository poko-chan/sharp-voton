CREATE OR REPLACE FUNCTION public.org_respond_invitation(_invite_id uuid, _accept boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v public.organization_invitations;
BEGIN
  SELECT * INTO v FROM public.organization_invitations WHERE id=_invite_id;
  IF v.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF v.invitee_id <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v.status <> 'pending' THEN RAISE EXCEPTION 'already responded'; END IF;
  UPDATE public.organization_invitations
    SET status = CASE WHEN _accept THEN 'accepted' ELSE 'rejected' END, responded_at=now()
    WHERE id=_invite_id;
  IF _accept THEN
    INSERT INTO public.organization_members(organization_id, user_id, role)
      VALUES (v.organization_id, v.invitee_id, (v.role)::public.org_role)
      ON CONFLICT (organization_id, user_id) DO UPDATE SET role=EXCLUDED.role, suspended=false;
  END IF;
END $function$;