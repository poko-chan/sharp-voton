GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_line_preferences TO authenticated;
GRANT ALL ON public.user_line_preferences TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parent_child_messages TO authenticated;
GRANT ALL ON public.parent_child_messages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.child_extension_requests TO authenticated;
GRANT ALL ON public.child_extension_requests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.child_controls TO authenticated;
GRANT ALL ON public.child_controls TO service_role;