-- 1) Login boards (admin announcements shown at login)
CREATE TABLE IF NOT EXISTS public.login_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL DEFAULT 'all',
  target_user_id uuid,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.login_boards TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.login_boards TO authenticated;
GRANT ALL ON public.login_boards TO service_role;
ALTER TABLE public.login_boards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "login_boards_read" ON public.login_boards;
CREATE POLICY "login_boards_read" ON public.login_boards FOR SELECT TO authenticated
USING (active AND (audience = 'all' OR target_user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "login_boards_admin_write" ON public.login_boards;
CREATE POLICY "login_boards_admin_write" ON public.login_boards FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) Seen tracking
CREATE TABLE IF NOT EXISTS public.user_board_seen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  board_id uuid NOT NULL REFERENCES public.login_boards(id) ON DELETE CASCADE,
  seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, board_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_board_seen TO authenticated;
GRANT ALL ON public.user_board_seen TO service_role;
ALTER TABLE public.user_board_seen ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_board_seen_own" ON public.user_board_seen;
CREATE POLICY "user_board_seen_own" ON public.user_board_seen FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 3) Fix organization invitation accept/re-invite unique conflict
ALTER TABLE public.organization_invitations
  DROP CONSTRAINT IF EXISTS organization_invitations_organization_id_invitee_id_status_key;
CREATE UNIQUE INDEX IF NOT EXISTS organization_invitations_pending_uniq
  ON public.organization_invitations (organization_id, invitee_id)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.org_respond_invitation(_invite_id uuid, _accept boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v public.organization_invitations;
BEGIN
  SELECT * INTO v FROM public.organization_invitations WHERE id = _invite_id;
  IF v.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF v.invitee_id <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v.status <> 'pending' THEN RAISE EXCEPTION 'already responded'; END IF;

  UPDATE public.organization_invitations
    SET status = CASE WHEN _accept THEN 'accepted' ELSE 'rejected' END, responded_at = now()
    WHERE id = _invite_id;

  IF _accept THEN
    INSERT INTO public.organization_members(organization_id, user_id, role)
      VALUES (v.organization_id, v.invitee_id, COALESCE(NULLIF(v.role, ''), 'member')::public.org_role)
      ON CONFLICT (organization_id, user_id)
      DO UPDATE SET role = EXCLUDED.role, suspended = false;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.org_respond_invitation(uuid, boolean) TO authenticated;