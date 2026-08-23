
-- ============ 1. makron_questions: hide answer keys ============
REVOKE SELECT ON public.makron_questions FROM authenticated, anon;
GRANT SELECT (id, unit_id, pack_id, prompt, image_url, type, options, explanation, points, grading, hint_text, order_idx, is_active, status, created_by, submitted_at, reviewed_at, reviewed_by, created_at, updated_at)
  ON public.makron_questions TO authenticated;
GRANT ALL ON public.makron_questions TO service_role;

-- ============ 2. org_edu_questions: hide answer/explanation ============
REVOKE SELECT ON public.org_edu_questions FROM authenticated, anon;
GRANT SELECT (id, organization_id, unit_id, kind, body, choices, hint_text, audience, level, sort_order, created_by, created_at, updated_at)
  ON public.org_edu_questions TO authenticated;
GRANT ALL ON public.org_edu_questions TO service_role;

-- staff-only key reader (for the management editor)
CREATE OR REPLACE FUNCTION public.org_edu_question_keys(_org uuid)
RETURNS TABLE (id uuid, answer text, explanation text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT q.id, q.answer, q.explanation
  FROM public.org_edu_questions q
  WHERE q.organization_id = _org
    AND public.is_org_staff(_org, auth.uid());
$$;
REVOKE ALL ON FUNCTION public.org_edu_question_keys(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.org_edu_question_keys(uuid) TO authenticated;

-- server-side grading + attempt recording
CREATE OR REPLACE FUNCTION public.org_edu_check_answer(_question uuid, _answer text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE q public.org_edu_questions; ok boolean;
BEGIN
  SELECT * INTO q FROM public.org_edu_questions WHERE id = _question;
  IF q.id IS NULL THEN RAISE EXCEPTION 'question not found'; END IF;
  IF NOT public.is_org_member(q.organization_id, auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;

  ok := lower(regexp_replace(coalesce(_answer,''), '\s+', '', 'g'))
      = lower(regexp_replace(coalesce(q.answer,''), '\s+', '', 'g'));

  INSERT INTO public.org_edu_attempts (organization_id, unit_id, question_id, user_id, correct, user_answer)
  VALUES (q.organization_id, q.unit_id, q.id, auth.uid(), ok, coalesce(_answer,''));

  RETURN jsonb_build_object('correct', ok, 'answer', q.answer, 'explanation', q.explanation);
END;
$$;
REVOKE ALL ON FUNCTION public.org_edu_check_answer(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.org_edu_check_answer(uuid, text) TO authenticated;

-- own wrong attempts, with answers revealed only after the attempt exists
CREATE OR REPLACE FUNCTION public.org_edu_review_rows(_org uuid, _include_done boolean DEFAULT false)
RETURNS TABLE (
  id uuid, created_at timestamptz, resolved_at timestamptz, user_answer text,
  ai_review text, unit_title text, body text, answer text, explanation text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.created_at, a.resolved_at, a.user_answer, a.ai_review,
         u.title, q.body, q.answer, q.explanation
  FROM public.org_edu_attempts a
  LEFT JOIN public.org_edu_questions q ON q.id = a.question_id
  LEFT JOIN public.org_edu_units u ON u.id = a.unit_id
  WHERE a.organization_id = _org
    AND a.user_id = auth.uid()
    AND a.correct = false
    AND (_include_done OR a.resolved_at IS NULL)
  ORDER BY a.created_at DESC
  LIMIT 100;
$$;
REVOKE ALL ON FUNCTION public.org_edu_review_rows(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.org_edu_review_rows(uuid, boolean) TO authenticated;

-- ============ 3. assignments: split quiz answer key ============
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS quiz_answer_key jsonb;

UPDATE public.assignments a
SET quiz_answer_key = (
      SELECT jsonb_agg(jsonb_build_object('id', e->>'id', 'answer', e->>'answer'))
      FROM jsonb_array_elements(a.quiz_questions) e
    ),
    quiz_questions = (
      SELECT jsonb_agg(e - 'answer')
      FROM jsonb_array_elements(a.quiz_questions) e
    )
WHERE a.quiz_questions IS NOT NULL
  AND jsonb_typeof(a.quiz_questions) = 'array'
  AND a.quiz_answer_key IS NULL;

REVOKE SELECT ON public.assignments FROM authenticated, anon;
GRANT SELECT (id, class_id, title, description, due_at, max_points, xp_mode, fixed_xp,
              created_by, kind, attachments, allowed_file_types, quiz_questions, created_at, updated_at)
  ON public.assignments TO authenticated;
GRANT ALL ON public.assignments TO service_role;

-- teachers can read the key through an explicit function
CREATE OR REPLACE FUNCTION public.assignment_quiz_key(_assignment uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid; k jsonb;
BEGIN
  SELECT class_id, quiz_answer_key INTO cid, k FROM public.assignments WHERE id = _assignment;
  IF cid IS NULL THEN RAISE EXCEPTION 'assignment not found'; END IF;
  IF NOT public.is_class_teacher(cid, auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN coalesce(k, '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.assignment_quiz_key(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.assignment_quiz_key(uuid) TO authenticated;

-- ============ 4. internal trigger functions must not be callable via the API ============
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef AND pg_get_function_result(p.oid) = 'trigger'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public, anon, authenticated', r.sig);
  END LOOP;
END $$;
