-- 1. weakness practice RPC: never return answer keys
DROP FUNCTION IF EXISTS public.makron_weakness_questions(uuid, integer);
CREATE OR REPLACE FUNCTION public.makron_weakness_questions(_unit_id uuid, _limit integer DEFAULT 10)
RETURNS TABLE(
  id uuid, unit_id uuid, pack_id uuid, prompt text, image_url text, type text,
  options jsonb, explanation text, points integer, grading text, hint_text text,
  order_idx integer, is_active boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT q.id, q.unit_id, q.pack_id, q.prompt, q.image_url, q.type,
         q.options, q.explanation, q.points, q.grading, q.hint_text,
         q.order_idx, q.is_active
    FROM public.makron_questions q
   WHERE q.is_active = true
     AND (_unit_id IS NULL OR q.unit_id = _unit_id)
     AND q.id IN (
       SELECT DISTINCT a.question_id FROM public.makron_answers a
       JOIN public.makron_sessions s ON s.id = a.session_id
       WHERE s.user_id = auth.uid()
         AND (a.is_correct = false OR (a.auto_correct = false AND a.is_correct IS NULL))
     )
   ORDER BY random()
   LIMIT GREATEST(1, LEAST(50, COALESCE(_limit,10)))
$$;
REVOKE ALL ON FUNCTION public.makron_weakness_questions(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.makron_weakness_questions(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.makron_weakness_questions(uuid, integer) TO authenticated;

-- 2. answer-key columns stay revoked (idempotent re-assertion)
REVOKE SELECT (correct_options, accepted_answers, model_answer) ON public.makron_questions FROM authenticated, anon;
REVOKE SELECT (answer, explanation) ON public.org_edu_questions FROM authenticated, anon;
REVOKE SELECT (quiz_answer_key) ON public.assignments FROM authenticated, anon;

-- 3. group challenges: participants / owner only
DROP POLICY IF EXISTS gc_r ON public.group_challenges;
CREATE POLICY gc_r ON public.group_challenges FOR SELECT TO authenticated
USING (
  auth.uid() = owner_id
  OR EXISTS (SELECT 1 FROM public.group_challenge_members m WHERE m.challenge_id = group_challenges.id AND m.user_id = auth.uid())
  OR public.has_role(auth.uid(),'admin')
);

DROP POLICY IF EXISTS gcm_r ON public.group_challenge_members;
CREATE POLICY gcm_r ON public.group_challenge_members FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.group_challenges c
     WHERE c.id = group_challenge_members.challenge_id
       AND (c.owner_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.group_challenge_members m2 WHERE m2.challenge_id = c.id AND m2.user_id = auth.uid()))
  )
  OR public.has_role(auth.uid(),'admin')
);

-- 4. gamification tables: self (+admin) only; leaderboards use SECURITY DEFINER RPCs
DROP POLICY IF EXISTS mxp_read_all ON public.makron_xp;
CREATE POLICY mxp_read_own ON public.makron_xp FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "view season" ON public.season_xp;
CREATE POLICY season_xp_read_own ON public.season_xp FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "view badges" ON public.user_badges;
CREATE POLICY user_badges_read_own ON public.user_badges FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "view titles" ON public.user_titles;
CREATE POLICY user_titles_read_own ON public.user_titles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS psl_r ON public.photo_study_logs;
CREATE POLICY psl_read_own ON public.photo_study_logs FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));