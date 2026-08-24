-- 1) Fix org join request approval: enum cast
CREATE OR REPLACE FUNCTION public.org_review_join_request(_req_id uuid, _approve boolean, _role org_role DEFAULT 'member'::org_role)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v public.organization_join_requests;
BEGIN
  SELECT * INTO v FROM public.organization_join_requests WHERE id=_req_id;
  IF v.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF NOT (public.is_org_admin(v.organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.organization_join_requests
     SET status = (CASE WHEN _approve THEN 'approved' ELSE 'rejected' END)::public.org_status,
         reviewed_by = auth.uid(), reviewed_at = now()
   WHERE id = _req_id;
  IF _approve THEN
    INSERT INTO public.organization_members(organization_id, user_id, role)
    VALUES (v.organization_id, v.user_id, _role)
    ON CONFLICT (organization_id, user_id) DO UPDATE SET role=EXCLUDED.role, suspended=false;
    INSERT INTO public.notifications(user_id,type,title,body)
    VALUES (v.user_id,'org_member_approved','組織への参加が承認されました','');
  ELSE
    INSERT INTO public.notifications(user_id,type,title,body)
    VALUES (v.user_id,'org_member_rejected','組織への参加が却下されました','');
  END IF;
END $function$;

-- 2) Missing unique index behind ON CONFLICT in org_invite_member
DELETE FROM public.organization_invitations a
 USING public.organization_invitations b
 WHERE a.ctid < b.ctid
   AND a.organization_id = b.organization_id
   AND a.invitee_id = b.invitee_id
   AND a.status = b.status;

CREATE UNIQUE INDEX IF NOT EXISTS organization_invitations_org_invitee_status_key
  ON public.organization_invitations (organization_id, invitee_id, status);

-- 3) Login board must be readable before signing in
GRANT SELECT ON public.login_boards TO anon;
DROP POLICY IF EXISTS login_boards_read_anon ON public.login_boards;
CREATE POLICY login_boards_read_anon ON public.login_boards
  FOR SELECT TO anon
  USING (active AND audience = 'all');

-- 4) Requested data reset: coins, Makron questions, Makron practice history
DELETE FROM public.makron_answers;
DELETE FROM public.makron_sessions;
DELETE FROM public.makron_daily_completions;
DELETE FROM public.makron_daily_sets;
DELETE FROM public.makron_pack_attempts;
DELETE FROM public.makron_assignments;
DELETE FROM public.makron_bookmarks;
DELETE FROM public.makron_question_likes;
DELETE FROM public.makron_reports;
DELETE FROM public.grading_history;
DELETE FROM public.difficulty_adjustments;
DELETE FROM public.makron_questions;
DELETE FROM public.makron_xp;

DELETE FROM public.coin_transactions;
UPDATE public.user_coins SET balance = 0, total_earned = 0, daily_earned = 0;