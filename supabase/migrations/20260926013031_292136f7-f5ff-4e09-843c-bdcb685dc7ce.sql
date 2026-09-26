CREATE OR REPLACE FUNCTION public.org_edu_norm(_s text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT lower(regexp_replace(
    translate(coalesce(_s,''),
      '０１２３４５６７８９ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ＋－＝．，（）アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポァィゥェォッャュョー',
      '0123456789abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz+-=.,()あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽぁぃぅぇぉっゃゅょー'),
    '[\s。、「」・!！?？"''`]+', '', 'g'))
$$;

CREATE OR REPLACE FUNCTION public.org_edu_check_answer(_question uuid, _answer text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE q public.org_edu_questions; ok boolean; a text;
BEGIN
  SELECT * INTO q FROM public.org_edu_questions WHERE id = _question;
  IF q.id IS NULL THEN RAISE EXCEPTION 'question not found'; END IF;
  IF NOT public.is_org_member(q.organization_id, auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  ok := false;
  FOREACH a IN ARRAY regexp_split_to_array(coalesce(q.answer,''), '\s*[|｜／]\s*') LOOP
    IF a <> '' AND public.org_edu_norm(_answer) = public.org_edu_norm(a) THEN ok := true; END IF;
  END LOOP;
  INSERT INTO public.org_edu_attempts (organization_id, unit_id, question_id, user_id, correct, user_answer)
  VALUES (q.organization_id, q.unit_id, q.id, auth.uid(), ok, coalesce(_answer,''));
  RETURN jsonb_build_object('correct', ok, 'answer', q.answer, 'explanation', q.explanation);
END;
$$;
REVOKE ALL ON FUNCTION public.org_edu_check_answer(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.org_edu_check_answer(uuid, text) TO authenticated;