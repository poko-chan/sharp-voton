
-- 1. user_coins: read-only for owner
DROP POLICY IF EXISTS uc_owner ON public.user_coins;
CREATE POLICY uc_select_own ON public.user_coins FOR SELECT TO authenticated USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE ON public.user_coins FROM authenticated;

-- 2. season_xp: read-only
DROP POLICY IF EXISTS "own season write" ON public.season_xp;
DROP POLICY IF EXISTS "own season update" ON public.season_xp;
REVOKE INSERT, UPDATE, DELETE ON public.season_xp FROM authenticated;

-- 3. class_members: self insert only as student
DROP POLICY IF EXISTS cm_insert_self ON public.class_members;
CREATE POLICY cm_insert_self ON public.class_members FOR INSERT TO authenticated
WITH CHECK ((user_id = auth.uid() AND role = 'student') OR public.is_class_teacher(class_id, auth.uid()));

-- 4. submissions: owner may edit only before grading, and never grading fields
DROP POLICY IF EXISTS sub_update ON public.submissions;
CREATE POLICY sub_update ON public.submissions FOR UPDATE TO authenticated
USING (
  (user_id = auth.uid() AND graded_at IS NULL)
  OR public.can_view_submission(assignment_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE OR REPLACE FUNCTION public.protect_submission_grading()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.can_view_submission(NEW.assignment_id, auth.uid())
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.score := OLD.score;
    NEW.feedback := OLD.feedback;
    NEW.graded_at := OLD.graded_at;
    NEW.graded_by := OLD.graded_by;
    NEW.xp_awarded := OLD.xp_awarded;
  END IF;
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS trg_protect_submission_grading ON public.submissions;
CREATE TRIGGER trg_protect_submission_grading BEFORE UPDATE ON public.submissions
FOR EACH ROW EXECUTE FUNCTION public.protect_submission_grading();

-- 5. group_rooms: hide join codes from non-members
DROP POLICY IF EXISTS gr_read ON public.group_rooms;
CREATE POLICY gr_read ON public.group_rooms FOR SELECT TO authenticated
USING (
  owner_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.group_room_members m WHERE m.room_id = group_rooms.id AND m.user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.join_group_room_by_code(_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_room uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT id INTO v_room FROM public.group_rooms WHERE code = _code AND active LIMIT 1;
  IF v_room IS NULL THEN RAISE EXCEPTION 'invalid code'; END IF;
  INSERT INTO public.group_room_members (room_id, user_id)
  VALUES (v_room, v_uid) ON CONFLICT DO NOTHING;
  RETURN v_room;
END;$$;
REVOKE ALL ON FUNCTION public.join_group_room_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_group_room_by_code(text) TO authenticated;

-- 6. org_notifications: only staff may notify others
DROP POLICY IF EXISTS "org notifications insert by staff" ON public.org_notifications;
CREATE POLICY "org notifications insert by staff" ON public.org_notifications FOR INSERT TO authenticated
WITH CHECK (
  (user_id = auth.uid() AND public.is_org_member(organization_id, auth.uid()))
  OR public.is_org_staff(organization_id, auth.uid())
);

-- 7. poll_votes: individual votes visible only to voter / poll owner / class teacher
DROP POLICY IF EXISTS pv_read ON public.poll_votes;
CREATE POLICY pv_read ON public.poll_votes FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.polls p
    WHERE p.id = poll_votes.poll_id
      AND (p.created_by = auth.uid() OR (p.class_id IS NOT NULL AND public.is_class_teacher(p.class_id, auth.uid())))
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE OR REPLACE FUNCTION public.poll_results(_poll_id uuid)
RETURNS TABLE(option_index int, votes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.option_index, count(*)::bigint
  FROM public.poll_votes v WHERE v.poll_id = _poll_id GROUP BY v.option_index
$$;
REVOKE ALL ON FUNCTION public.poll_results(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.poll_results(uuid) TO authenticated;

-- 8. claim_daily_mission: server-side reward lookup
DROP FUNCTION IF EXISTS public.claim_daily_mission(text, date, integer, integer);
CREATE OR REPLACE FUNCTION public.claim_daily_mission(_kind text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tpl public.daily_mission_templates%ROWTYPE;
  v_rows int := 0;
  v_date date := (now() AT TIME ZONE 'Asia/Tokyo')::date;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO v_tpl FROM public.daily_mission_templates WHERE code = _kind AND is_active LIMIT 1;
  IF v_tpl.id IS NULL THEN RAISE EXCEPTION 'unknown mission'; END IF;

  INSERT INTO public.daily_missions (user_id, date, kind, target_value, progress, completed, reward_coins)
  VALUES (v_uid, v_date, v_tpl.code, v_tpl.target, v_tpl.target, true, v_tpl.reward_coins)
  ON CONFLICT (user_id, date, kind) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('awarded', 0, 'already_claimed', true);
  END IF;

  INSERT INTO public.user_coins (user_id, balance, total_earned)
    VALUES (v_uid, v_tpl.reward_coins, v_tpl.reward_coins)
    ON CONFLICT (user_id) DO UPDATE
      SET balance = public.user_coins.balance + v_tpl.reward_coins,
          total_earned = public.user_coins.total_earned + v_tpl.reward_coins;

  INSERT INTO public.coin_transactions (user_id, amount, reason, metadata)
    VALUES (v_uid, v_tpl.reward_coins, 'mission:' || v_tpl.code, jsonb_build_object('date', v_date));

  RETURN jsonb_build_object('awarded', v_tpl.reward_coins, 'already_claimed', false);
END;$$;
REVOKE ALL ON FUNCTION public.claim_daily_mission(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_daily_mission(text) TO authenticated;

-- 9. mentor reward via trusted function (client can no longer write coins)
CREATE OR REPLACE FUNCTION public.answer_mentor_session(_id uuid, _answer text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_reward int := 15; v_rows int := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _answer IS NULL OR length(btrim(_answer)) = 0 OR length(_answer) > 5000 THEN
    RAISE EXCEPTION 'invalid answer';
  END IF;
  UPDATE public.mentor_sessions
     SET mentor_id = v_uid, answer = _answer, reward_coins = v_reward
   WHERE id = _id AND answer IS NULL AND student_id IS DISTINCT FROM v_uid;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RETURN jsonb_build_object('awarded', 0); END IF;

  INSERT INTO public.user_coins (user_id, balance, total_earned)
    VALUES (v_uid, v_reward, v_reward)
    ON CONFLICT (user_id) DO UPDATE
      SET balance = public.user_coins.balance + v_reward,
          total_earned = public.user_coins.total_earned + v_reward;
  INSERT INTO public.coin_transactions (user_id, amount, reason, metadata)
    VALUES (v_uid, v_reward, 'mentor:answer', jsonb_build_object('session_id', _id));
  RETURN jsonb_build_object('awarded', v_reward);
END;$$;
REVOKE ALL ON FUNCTION public.answer_mentor_session(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.answer_mentor_session(uuid, text) TO authenticated;
