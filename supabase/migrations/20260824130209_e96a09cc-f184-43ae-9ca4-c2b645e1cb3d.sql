CREATE OR REPLACE FUNCTION public.my_profile_private()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'email', p.email,
    'username', p.username,
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