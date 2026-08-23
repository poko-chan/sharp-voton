-- 1) Hide answer keys on makron_questions from clients (server RPCs still read them)
REVOKE SELECT (correct_options, accepted_answers, model_answer)
  ON public.makron_questions FROM authenticated, anon;

-- 2) Hide private profile columns from other users (self access via my_profile_private)
REVOKE SELECT (email, referral_code, deletion_scheduled_at)
  ON public.profiles FROM authenticated, anon;

-- 3) Answer key reads for admins / question owners (editor screens)
CREATE OR REPLACE FUNCTION public.makron_question_keys(_ids uuid[])
RETURNS TABLE(id uuid, correct_options jsonb, accepted_answers jsonb, model_answer text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT q.id, q.correct_options, q.accepted_answers, q.model_answer
    FROM public.makron_questions q
   WHERE q.id = ANY(_ids)
     AND (public.has_role(auth.uid(),'admin') OR q.created_by = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.makron_question_keys(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.makron_question_keys(uuid[]) TO authenticated;