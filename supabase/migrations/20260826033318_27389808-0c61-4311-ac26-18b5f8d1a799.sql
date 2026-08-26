ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarded_at timestamptz,
  ADD COLUMN IF NOT EXISTS tutorial_done boolean NOT NULL DEFAULT false;

-- 既存ユーザーは初期設定済みとみなす
UPDATE public.profiles SET onboarded_at = COALESCE(onboarded_at, created_at) WHERE username IS NOT NULL;

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
    'account_kind', p.account_kind,
    'onboarded_at', p.onboarded_at,
    'tutorial_done', p.tutorial_done,
    'notify_daily_reminder', p.notify_daily_reminder,
    'notify_chat', p.notify_chat,
    'notify_streak_break', p.notify_streak_break,
    'notify_announcements', p.notify_announcements,
    'notify_email', p.notify_email,
    'reminder_time', p.reminder_time,
    'theme', p.theme
  ) FROM public.profiles p WHERE p.id = auth.uid();
$function$;