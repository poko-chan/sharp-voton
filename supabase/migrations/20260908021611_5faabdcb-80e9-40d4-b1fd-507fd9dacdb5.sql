REVOKE ALL ON FUNCTION public.org_member_stats(uuid) FROM public;
REVOKE ALL ON FUNCTION public.org_member_stats(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.org_member_stats(uuid) TO authenticated;