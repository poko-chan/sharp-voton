CREATE OR REPLACE FUNCTION public.makron_eval(_q makron_questions, _answer jsonb)
 RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v text; arr text[]; corr text[]; acc text[]; n numeric; i int; ok boolean;
BEGIN
  IF _q.grading <> 'auto' THEN RETURN NULL; END IF;
  corr := COALESCE((SELECT array_agg(x ORDER BY ord) FROM jsonb_array_elements_text(COALESCE(_q.correct_options,'[]'::jsonb)) WITH ORDINALITY t(x,ord)), '{}');
  acc  := COALESCE((SELECT array_agg(x ORDER BY ord) FROM jsonb_array_elements_text(COALESCE(_q.accepted_answers,'[]'::jsonb)) WITH ORDINALITY t(x,ord)), '{}');
  IF _q.type IN ('single','true_false') THEN
    v := _answer #>> '{}';
    RETURN v IS NOT NULL AND COALESCE(array_length(corr,1),0) >= 1 AND corr[1] = v;
  ELSIF _q.type = 'multi' THEN
    IF jsonb_typeof(_answer) <> 'array' THEN RETURN false; END IF;
    arr := COALESCE((SELECT array_agg(x ORDER BY x) FROM jsonb_array_elements_text(_answer) x), '{}');
    RETURN arr = COALESCE((SELECT array_agg(x ORDER BY x) FROM unnest(corr) x), '{}');
  ELSIF _q.type IN ('text','ocr','listen') THEN
    v := regexp_replace(lower(btrim(COALESCE(_answer #>> '{}',''))), '[\s。、.,!?！？]+', '', 'g');
    RETURN EXISTS (SELECT 1 FROM unnest(acc) a WHERE regexp_replace(lower(btrim(a)), '[\s。、.,!?！？]+', '', 'g') = v);
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
  ELSIF _q.type IN ('ordering','tiles') THEN
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
END $function$;