ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS character_profile jsonb NOT NULL DEFAULT '{}'::jsonb;

GRANT SELECT (character_profile) ON public.profiles TO authenticated;
GRANT SELECT (character_profile) ON public.profiles TO anon;
GRANT UPDATE (character_profile) ON public.profiles TO authenticated;

DROP FUNCTION IF EXISTS public.public_profiles_by_ids(uuid[]);
CREATE OR REPLACE FUNCTION public.public_profiles_by_ids(_ids uuid[])
RETURNS TABLE (id uuid, username text, display_name text, avatar_url text, character_profile jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $function$
  SELECT p.id, p.username, p.display_name, p.avatar_url, p.character_profile
  FROM public.profiles p WHERE p.id = ANY(_ids)
$function$;

DROP FUNCTION IF EXISTS public.search_public_profiles(text);
CREATE OR REPLACE FUNCTION public.search_public_profiles(_q text)
RETURNS TABLE (id uuid, username text, display_name text, avatar_url text, character_profile jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $function$
  SELECT p.id, p.username, p.display_name, p.avatar_url, p.character_profile
  FROM public.profiles p
  WHERE length(coalesce(_q, '')) >= 2
    AND (p.username ILIKE '%' || _q || '%' OR p.display_name ILIKE '%' || _q || '%')
  ORDER BY p.username LIMIT 20
$function$;

REVOKE ALL ON FUNCTION public.public_profiles_by_ids(uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.public_profiles_by_ids(uuid[]) TO authenticated;
REVOKE ALL ON FUNCTION public.search_public_profiles(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.search_public_profiles(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_profile_private()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
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
    'character_profile', p.character_profile,
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
