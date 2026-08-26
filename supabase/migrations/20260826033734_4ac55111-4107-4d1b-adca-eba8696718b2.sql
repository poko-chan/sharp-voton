CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_kind text;
  v_base text;
  v_username text;
  v_try int := 0;
  v_onboarded timestamptz;
BEGIN
  v_kind := COALESCE(NEW.raw_user_meta_data->>'account_kind', 'child');
  IF v_kind NOT IN ('child','parent','adult','org') THEN
    v_kind := 'child';
  END IF;

  v_base := COALESCE(NULLIF(NEW.raw_user_meta_data->>'username', ''), split_part(NEW.email, '@', 1));
  v_username := v_base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = v_username) AND v_try < 50 LOOP
    v_try := v_try + 1;
    v_username := v_base || v_try::text;
  END LOOP;

  IF NULLIF(NEW.raw_user_meta_data->>'username', '') IS NOT NULL THEN
    v_onboarded := now();
  END IF;

  INSERT INTO public.profiles (id, email, username, display_name, account_kind, referral_code, onboarded_at)
  VALUES (
    NEW.id, NEW.email,
    v_username,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name', ''), v_base),
    v_kind,
    upper(substr(replace(NEW.id::text,'-',''),1,8)),
    v_onboarded
  ) ON CONFLICT (id) DO UPDATE SET account_kind = EXCLUDED.account_kind;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;