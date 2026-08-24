-- 1) Class Q&A: restrict reads to class members
DROP POLICY IF EXISTS qa_q_read ON public.class_qa_questions;
CREATE POLICY qa_q_read ON public.class_qa_questions
  FOR SELECT TO authenticated
  USING (public.is_class_member(class_id, auth.uid()));

DROP POLICY IF EXISTS qa_a_read ON public.class_qa_answers;
CREATE POLICY qa_a_read ON public.class_qa_answers
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.class_qa_questions q
    WHERE q.id = class_qa_answers.question_id
      AND public.is_class_member(q.class_id, auth.uid())
  ));

-- 2) profiles: column-level restriction of private fields
REVOKE SELECT ON public.profiles FROM anon, authenticated;

GRANT SELECT (
  id, username, display_name, avatar_url,
  active_title, active_frame, active_theme, theme,
  account_kind, created_at, updated_at
) ON public.profiles TO authenticated;

GRANT SELECT (
  id, username, display_name, avatar_url, active_title, active_frame, active_theme
) ON public.profiles TO anon;

GRANT ALL ON public.profiles TO service_role;

-- owner-only access to private fields
CREATE OR REPLACE FUNCTION public.my_profile_private()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'email', p.email,
    'referral_code', p.referral_code,
    'deletion_scheduled_at', p.deletion_scheduled_at,
    'current_plan', p.current_plan,
    'display_name', p.display_name,
    'avatar_url', p.avatar_url,
    'notify_daily_reminder', p.notify_daily_reminder,
    'notify_chat', p.notify_chat,
    'notify_streak_break', p.notify_streak_break,
    'notify_announcements', p.notify_announcements,
    'notify_email', p.notify_email,
    'reminder_time', p.reminder_time,
    'theme', p.theme
  ) FROM public.profiles p WHERE p.id = auth.uid();
$function$;

REVOKE ALL ON FUNCTION public.my_profile_private() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_profile_private() TO authenticated;