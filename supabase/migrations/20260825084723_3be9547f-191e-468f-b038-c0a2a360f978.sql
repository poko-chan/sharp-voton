
DROP VIEW IF EXISTS public.public_profiles;

CREATE OR REPLACE FUNCTION public.public_profiles_by_ids(_ids uuid[])
RETURNS TABLE (id uuid, username text, display_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.username, p.display_name, p.avatar_url
  FROM public.profiles p
  WHERE p.id = ANY(_ids)
$$;

REVOKE ALL ON FUNCTION public.public_profiles_by_ids(uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.public_profiles_by_ids(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.search_public_profiles(_q text)
RETURNS TABLE (id uuid, username text, display_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.username, p.display_name, p.avatar_url
  FROM public.profiles p
  WHERE length(coalesce(_q, '')) >= 2
    AND (p.username ILIKE '%' || _q || '%' OR p.display_name ILIKE '%' || _q || '%')
  ORDER BY p.username
  LIMIT 20
$$;

REVOKE ALL ON FUNCTION public.search_public_profiles(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.search_public_profiles(text) TO authenticated;
