REVOKE ALL ON FUNCTION public.share_study_summary(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.share_study_summary(text) TO service_role;