CREATE OR REPLACE FUNCTION public.makron_match_choices(_question_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT btrim(split_part(x, '=>', 2))), '{}')
  FROM public.makron_questions q,
       LATERAL jsonb_array_elements_text(COALESCE(q.accepted_answers, '[]'::jsonb)) AS x
  WHERE q.id = _question_id
    AND q.type = 'matching'
    AND btrim(split_part(x, '=>', 2)) <> '';
$$;

REVOKE ALL ON FUNCTION public.makron_match_choices(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.makron_match_choices(uuid) TO authenticated;