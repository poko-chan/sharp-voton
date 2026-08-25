-- assignments: hide quiz_answer_key from clients (column-level SELECT)
REVOKE SELECT ON public.assignments FROM authenticated;
REVOKE SELECT ON public.assignments FROM anon;
GRANT SELECT (id, class_id, created_by, title, description, due_at, max_points, xp_mode, fixed_xp, attachments, allowed_file_types, kind, quiz_questions, created_at, updated_at)
  ON public.assignments TO authenticated;

-- org_edu_questions: hide answer/explanation from clients
REVOKE SELECT ON public.org_edu_questions FROM authenticated;
REVOKE SELECT ON public.org_edu_questions FROM anon;
GRANT SELECT (id, organization_id, unit_id, kind, body, choices, hint_text, audience, level, sort_order, created_by, created_at, updated_at)
  ON public.org_edu_questions TO authenticated;
