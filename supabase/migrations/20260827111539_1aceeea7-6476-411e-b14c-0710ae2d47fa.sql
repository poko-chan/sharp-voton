CREATE OR REPLACE FUNCTION public.makron_my_answer_keys()
RETURNS TABLE(question_id uuid, correct_answer text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT q.id, public.makron_correct_answer_text(q)
    FROM public.makron_answers a
    JOIN public.makron_sessions s ON s.id = a.session_id
    JOIN public.makron_questions q ON q.id = a.question_id
   WHERE s.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.makron_my_answer_keys() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.makron_my_answer_keys() FROM anon;
GRANT EXECUTE ON FUNCTION public.makron_my_answer_keys() TO authenticated;