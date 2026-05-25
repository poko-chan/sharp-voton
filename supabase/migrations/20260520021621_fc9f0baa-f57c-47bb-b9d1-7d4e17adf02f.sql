ALTER TABLE public.class_student_permissions
  ADD CONSTRAINT class_student_permissions_class_student_unique
  UNIQUE (class_id, student_id);