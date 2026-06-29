GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_series TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_subjects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_todos TO authenticated;
GRANT ALL ON public.exam_series TO service_role;
GRANT ALL ON public.exams TO service_role;
GRANT ALL ON public.exam_subjects TO service_role;
GRANT ALL ON public.exam_todos TO service_role;