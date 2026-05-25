GRANT EXECUTE ON FUNCTION public.is_class_member(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_class_teacher(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_view_submission(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_user_study_stats(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_class_by_code(text) TO authenticated;