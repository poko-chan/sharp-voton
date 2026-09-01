ALTER TABLE public.makron_sessions ALTER COLUMN unit_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.makron_start_pack_session(_pack_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_pack public.makron_packs;
  v_att  public.makron_pack_attempts;
  v_session uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO v_pack FROM public.makron_packs WHERE id = _pack_id;
  IF v_pack.id IS NULL THEN RAISE EXCEPTION 'pack not found'; END IF;
  IF v_pack.status <> 'approved' AND v_pack.created_by <> v_user AND NOT public.has_role(v_user,'admin') THEN
    RAISE EXCEPTION 'pack not available';
  END IF;

  SELECT * INTO v_att FROM public.makron_pack_attempts WHERE user_id=v_user AND pack_id=_pack_id FOR UPDATE;
  IF v_att.user_id IS NULL THEN
    INSERT INTO public.makron_pack_attempts(user_id, pack_id, attempts_count, last_attempt_at)
      VALUES (v_user, _pack_id, 1, now()) RETURNING * INTO v_att;
  ELSE
    IF v_pack.max_attempts IS NOT NULL AND v_att.attempts_count >= v_pack.max_attempts THEN
      RAISE EXCEPTION 'このパックの演習回数上限に達しています';
    END IF;
    UPDATE public.makron_pack_attempts
       SET attempts_count = attempts_count + 1, last_attempt_at = now()
     WHERE user_id=v_user AND pack_id=_pack_id RETURNING * INTO v_att;
  END IF;

  INSERT INTO public.makron_sessions(user_id, unit_id, pack_id, kind)
    VALUES (v_user, v_pack.unit_id, _pack_id, CASE WHEN v_pack.unit_id IS NULL THEN 'pack' ELSE 'unit' END)
    RETURNING id INTO v_session;
  RETURN v_session;
END $function$;