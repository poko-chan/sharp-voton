-- ============ 1. chat_messages: recipients may only mark as read ============
DROP POLICY IF EXISTS chat_update_own ON public.chat_messages;
CREATE POLICY chat_update_participants ON public.chat_messages
  FOR UPDATE TO authenticated
  USING ((auth.uid() = sender_id) OR (auth.uid() = recipient_id) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK ((auth.uid() = sender_id) OR (auth.uid() = recipient_id) OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.chat_messages_guard_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() = OLD.sender_id OR public.has_role(auth.uid(),'admin') THEN
    RETURN NEW;
  END IF;
  NEW.id := OLD.id;
  NEW.sender_id := OLD.sender_id;
  NEW.recipient_id := OLD.recipient_id;
  NEW.content := OLD.content;
  NEW.edited_at := OLD.edited_at;
  NEW.deleted_at := OLD.deleted_at;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS chat_messages_guard ON public.chat_messages;
CREATE TRIGGER chat_messages_guard BEFORE UPDATE ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.chat_messages_guard_update();

-- ============ 2. org_chat_messages insert policy bug ============
DROP POLICY IF EXISTS "messages insert" ON public.org_chat_messages;
CREATE POLICY "messages insert" ON public.org_chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.org_chat_participants p
      WHERE p.thread_id = org_chat_messages.thread_id
        AND p.user_id = auth.uid()
        AND p.status = 'accepted'
    )
  );

-- ============ 3. share_tokens: no public enumeration ============
DROP POLICY IF EXISTS st_public_read ON public.share_tokens;
REVOKE SELECT ON public.share_tokens FROM anon;

-- ============ 4. user_inventory: read-only for users ============
DROP POLICY IF EXISTS "own inv" ON public.user_inventory;
CREATE POLICY inv_select_own ON public.user_inventory
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE ON public.user_inventory FROM authenticated, anon;

-- ============ 5. makron_sessions / makron_answers: no self-grading ============
DROP POLICY IF EXISTS ms_own ON public.makron_sessions;
CREATE POLICY ms_select_own ON public.makron_sessions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY ms_delete_own ON public.makron_sessions
  FOR DELETE TO authenticated USING (user_id = auth.uid());
REVOKE INSERT, UPDATE ON public.makron_sessions FROM authenticated, anon;

DROP POLICY IF EXISTS ma_own ON public.makron_answers;
CREATE POLICY ma_select_own ON public.makron_answers
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.makron_sessions s WHERE s.id = makron_answers.session_id AND s.user_id = auth.uid()
  ));
REVOKE INSERT, UPDATE, DELETE ON public.makron_answers FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.makron_session_set_scratchpad(_session_id uuid, _data text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.makron_sessions SET scratchpad = _data
   WHERE id = _session_id AND user_id = auth.uid() AND finished_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'session not editable'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.makron_session_set_all_mode(_session_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.makron_sessions SET all_mode = true
   WHERE id = _session_id AND user_id = auth.uid() AND finished_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'session not editable'; END IF;
END $$;

-- ============ 6. makron_questions: hide answer keys ============
REVOKE SELECT (correct_options, accepted_answers, model_answer) ON public.makron_questions FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.makron_eval(_q public.makron_questions, _answer jsonb)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v text; arr text[]; corr text[]; acc text[]; n numeric; i int; ok boolean;
BEGIN
  IF _q.grading <> 'auto' THEN RETURN NULL; END IF;
  corr := COALESCE((SELECT array_agg(x ORDER BY ord) FROM jsonb_array_elements_text(COALESCE(_q.correct_options,'[]'::jsonb)) WITH ORDINALITY t(x,ord)), '{}');
  acc  := COALESCE((SELECT array_agg(x ORDER BY ord) FROM jsonb_array_elements_text(COALESCE(_q.accepted_answers,'[]'::jsonb)) WITH ORDINALITY t(x,ord)), '{}');
  IF _q.type = 'single' THEN
    v := _answer #>> '{}';
    RETURN v IS NOT NULL AND COALESCE(array_length(corr,1),0) >= 1 AND corr[1] = v;
  ELSIF _q.type = 'multi' THEN
    IF jsonb_typeof(_answer) <> 'array' THEN RETURN false; END IF;
    arr := COALESCE((SELECT array_agg(x ORDER BY x) FROM jsonb_array_elements_text(_answer) x), '{}');
    RETURN arr = COALESCE((SELECT array_agg(x ORDER BY x) FROM unnest(corr) x), '{}');
  ELSIF _q.type IN ('text','ocr') THEN
    v := lower(btrim(COALESCE(_answer #>> '{}','')));
    RETURN EXISTS (SELECT 1 FROM unnest(acc) a WHERE lower(btrim(a)) = v);
  ELSIF _q.type = 'numeric' THEN
    BEGIN n := (COALESCE(_answer #>> '{}',''))::numeric; EXCEPTION WHEN others THEN RETURN false; END;
    RETURN EXISTS (SELECT 1 FROM unnest(acc) a WHERE btrim(a) ~ '^-?[0-9]+(\.[0-9]+)?$' AND btrim(a)::numeric = n);
  ELSIF _q.type = 'fill_blank' THEN
    IF jsonb_typeof(_answer) <> 'array' THEN RETURN false; END IF;
    arr := COALESCE((SELECT array_agg(x ORDER BY ord) FROM jsonb_array_elements_text(_answer) WITH ORDINALITY t(x,ord)), '{}');
    IF COALESCE(array_length(arr,1),0) <> COALESCE(array_length(acc,1),0) THEN RETURN false; END IF;
    ok := true;
    FOR i IN 1..COALESCE(array_length(arr,1),0) LOOP
      IF lower(btrim(COALESCE(arr[i],''))) <> lower(btrim(COALESCE(acc[i],''))) THEN ok := false; END IF;
    END LOOP;
    RETURN ok;
  ELSIF _q.type = 'ordering' THEN
    IF jsonb_typeof(_answer) <> 'array' THEN RETURN false; END IF;
    arr := COALESCE((SELECT array_agg(x ORDER BY ord) FROM jsonb_array_elements_text(_answer) WITH ORDINALITY t(x,ord)), '{}');
    RETURN arr = corr;
  ELSIF _q.type = 'matching' THEN
    IF jsonb_typeof(_answer) <> 'object' THEN RETURN false; END IF;
    ok := COALESCE(array_length(acc,1),0) > 0;
    FOREACH v IN ARRAY acc LOOP
      IF position('=>' in v) > 0 THEN
        IF btrim(COALESCE(_answer ->> btrim(split_part(v,'=>',1)),'')) <> btrim(split_part(v,'=>',2)) THEN ok := false; END IF;
      END IF;
    END LOOP;
    RETURN ok;
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.makron_correct_answer_text(_q public.makron_questions)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _q.type IN ('single','multi','ordering') THEN
      COALESCE((SELECT string_agg(x, ', ' ORDER BY ord) FROM jsonb_array_elements_text(COALESCE(_q.correct_options,'[]'::jsonb)) WITH ORDINALITY t(x,ord)), '')
    WHEN _q.type IN ('text','numeric','ocr','fill_blank','matching') THEN
      COALESCE((SELECT string_agg(x, ' / ' ORDER BY ord) FROM jsonb_array_elements_text(COALESCE(_q.accepted_answers,'[]'::jsonb)) WITH ORDINALITY t(x,ord)), '')
    ELSE COALESCE(_q.model_answer, '')
  END
$$;

CREATE OR REPLACE FUNCTION public.makron_grade_one(_session_id uuid, _question_id uuid, _answer jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE q public.makron_questions; s public.makron_sessions;
BEGIN
  SELECT * INTO s FROM public.makron_sessions WHERE id = _session_id;
  IF s.id IS NULL OR s.user_id <> auth.uid() THEN RAISE EXCEPTION 'not your session'; END IF;
  SELECT * INTO q FROM public.makron_questions WHERE id = _question_id;
  IF q.id IS NULL THEN RAISE EXCEPTION 'question not found'; END IF;
  RETURN jsonb_build_object(
    'correct', public.makron_eval(q, _answer),
    'correct_answer', public.makron_correct_answer_text(q),
    'explanation', q.explanation,
    'model_answer', q.model_answer,
    'points', q.points
  );
END $$;

CREATE OR REPLACE FUNCTION public.makron_model_answers(_session_id uuid)
RETURNS TABLE(question_id uuid, model_answer text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.makron_sessions;
BEGIN
  SELECT * INTO s FROM public.makron_sessions WHERE id = _session_id;
  IF s.id IS NULL OR s.user_id <> auth.uid() THEN RAISE EXCEPTION 'not your session'; END IF;
  RETURN QUERY
    SELECT q.id, q.model_answer FROM public.makron_questions q
     WHERE q.type IN ('written','long_text')
       AND (
         (s.question_ids IS NOT NULL AND q.id = ANY (s.question_ids))
         OR (s.pack_id IS NOT NULL AND q.pack_id = s.pack_id)
         OR (s.pack_id IS NULL AND s.unit_id IS NOT NULL AND q.unit_id = s.unit_id)
       );
END $$;

CREATE OR REPLACE FUNCTION public.makron_submit_session(_session_id uuid, _answers jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.makron_sessions; q public.makron_questions; item jsonb;
        auto boolean; pts integer; is_c boolean; ai numeric;
BEGIN
  SELECT * INTO s FROM public.makron_sessions WHERE id = _session_id;
  IF s.id IS NULL OR s.user_id <> auth.uid() THEN RAISE EXCEPTION 'not your session'; END IF;
  IF s.finished_at IS NOT NULL THEN RAISE EXCEPTION 'session already finished'; END IF;
  IF jsonb_typeof(_answers) <> 'array' THEN RAISE EXCEPTION 'invalid payload'; END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(_answers) LOOP
    SELECT * INTO q FROM public.makron_questions WHERE id = (item->>'question_id')::uuid;
    CONTINUE WHEN q.id IS NULL;
    auto := public.makron_eval(q, item->'answer');
    pts := CASE WHEN auto IS TRUE THEN q.points WHEN auto IS FALSE THEN 0 ELSE NULL END;
    is_c := auto;
    IF q.type IN ('written','long_text') AND (item ? 'ai_score') AND jsonb_typeof(item->'ai_score') = 'number' THEN
      ai := LEAST(GREATEST((item->>'ai_score')::numeric, 0), COALESCE(q.points,0));
      pts := round(ai)::int;
      is_c := CASE WHEN COALESCE(q.points,0) > 0 THEN ai >= q.points * 0.6 ELSE NULL END;
    END IF;
    INSERT INTO public.makron_answers (session_id, question_id, answer, file_url, auto_correct, awarded_points, review_flag, is_correct, manual_comment)
    VALUES (_session_id, q.id, item->'answer', NULLIF(item->>'file_url',''), auto, pts,
            COALESCE((item->>'review_flag')::boolean, false), is_c, NULLIF(item->>'ai_comment',''))
    ON CONFLICT (session_id, question_id) DO UPDATE
      SET answer = EXCLUDED.answer, file_url = EXCLUDED.file_url, auto_correct = EXCLUDED.auto_correct,
          awarded_points = EXCLUDED.awarded_points, review_flag = EXCLUDED.review_flag,
          is_correct = EXCLUDED.is_correct, manual_comment = EXCLUDED.manual_comment;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.makron_reveal(_session_id uuid)
RETURNS TABLE(question_id uuid, correct_options jsonb, accepted_answers jsonb, model_answer text, correct_answer text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.makron_sessions;
BEGIN
  SELECT * INTO s FROM public.makron_sessions WHERE id = _session_id;
  IF s.id IS NULL THEN RAISE EXCEPTION 'session not found'; END IF;
  IF s.user_id <> auth.uid() AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF s.finished_at IS NULL AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'session not finished'; END IF;
  RETURN QUERY
    SELECT q.id, q.correct_options, q.accepted_answers, q.model_answer, public.makron_correct_answer_text(q)
      FROM public.makron_questions q
     WHERE q.id IN (SELECT a.question_id FROM public.makron_answers a WHERE a.session_id = _session_id);
END $$;

CREATE OR REPLACE FUNCTION public.makron_question_keys(_ids uuid[])
RETURNS TABLE(id uuid, correct_options jsonb, accepted_answers jsonb, model_answer text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT q.id, q.correct_options, q.accepted_answers, q.model_answer
    FROM public.makron_questions q
   WHERE q.id = ANY(_ids)
     AND (public.has_role(auth.uid(),'admin') OR q.created_by = auth.uid());
$$;

-- ============ 7. profiles: hide sensitive columns ============
REVOKE SELECT (email, deletion_code, deletion_code_expires_at, deletion_scheduled_at, referral_code)
  ON public.profiles FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.my_profile_private()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'email', p.email,
    'referral_code', p.referral_code,
    'deletion_scheduled_at', p.deletion_scheduled_at
  ) FROM public.profiles p WHERE p.id = auth.uid();
$$;

-- ============ 8. Storage: owner-scoped reads ============
DROP POLICY IF EXISTS tutor_files_read_public ON storage.objects;
CREATE POLICY tutor_files_read_own ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'tutor-files' AND (auth.uid())::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS classroom_files_read ON storage.objects;
CREATE POLICY classroom_files_read_own ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'classroom-files' AND (auth.uid())::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "makron read all auth" ON storage.objects;
CREATE POLICY makron_files_read_own ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'makron-files'
         AND ((auth.uid())::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin')));

-- ============ 9. Function hardening ============
ALTER FUNCTION public.current_jst_date() SET search_path = public;
ALTER FUNCTION public.jst_today() SET search_path = public;
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig, p.prorettype = 'trigger'::regtype AS is_trigger
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    IF r.is_trigger THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.sig);
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    END IF;
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.share_study_summary(text) TO anon;