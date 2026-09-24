CREATE OR REPLACE FUNCTION public.org_edu_ranking(_org uuid)
RETURNS TABLE(user_id uuid, display_name text, xp integer, total_correct integer, current_streak integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.user_id, COALESCE(p.display_name, 'ユーザー'), s.xp, s.total_correct, s.current_streak
  FROM org_edu_streaks s LEFT JOIN profiles p ON p.id = s.user_id
  WHERE s.organization_id = _org
    AND (is_org_member(_org, auth.uid()) OR has_role(auth.uid(), 'admin'))
  ORDER BY s.xp DESC LIMIT 50
$$;
REVOKE EXECUTE ON FUNCTION public.org_edu_ranking(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.org_edu_ranking(uuid) TO authenticated;