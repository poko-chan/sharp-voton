CREATE OR REPLACE FUNCTION public.org_member_stats(_org uuid)
 RETURNS TABLE(user_id uuid, username text, display_name text, role org_role, minutes_7d bigint, minutes_30d bigint, sessions_30d bigint, last_studied timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.is_org_staff(_org, auth.uid()) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION '権限がありません';
  END IF;
  RETURN QUERY
  SELECT m.user_id, p.username, p.display_name, m.role,
    coalesce(sum(l.duration_minutes) FILTER (WHERE l.date >= current_date - 7), 0)::bigint,
    coalesce(sum(l.duration_minutes) FILTER (WHERE l.date >= current_date - 30), 0)::bigint,
    count(l.id) FILTER (WHERE l.date >= current_date - 30)::bigint,
    max(l.created_at)
  FROM public.organization_members m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  LEFT JOIN public.study_logs l ON l.user_id = m.user_id
  WHERE m.organization_id = _org
  GROUP BY m.user_id, p.username, p.display_name, m.role
  ORDER BY 5 DESC;
END; $function$;

CREATE OR REPLACE FUNCTION public.org_monitor_overview(_org uuid)
 RETURNS TABLE(user_id uuid, display_name text, role org_role, minutes_7d bigint, minutes_30d bigint,
   last_studied date, absents_30d bigint, lates_30d bigint, open_flags bigint, health_30d bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.is_org_staff(_org, auth.uid()) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION '権限がありません';
  END IF;
  RETURN QUERY
  SELECT m.user_id,
    coalesce(op.display_name, p.display_name, p.username, '（名前未設定）'),
    m.role,
    coalesce((SELECT sum(l.duration_minutes) FROM public.study_logs l
      WHERE l.user_id = m.user_id AND l.date >= current_date - 7), 0)::bigint,
    coalesce((SELECT sum(l.duration_minutes) FROM public.study_logs l
      WHERE l.user_id = m.user_id AND l.date >= current_date - 30), 0)::bigint,
    (SELECT max(l.date) FROM public.study_logs l WHERE l.user_id = m.user_id),
    (SELECT count(*) FROM public.org_attendance a WHERE a.organization_id = _org
      AND a.user_id = m.user_id AND a.date >= current_date - 30 AND a.status = 'absent')::bigint,
    (SELECT count(*) FROM public.org_attendance a WHERE a.organization_id = _org
      AND a.user_id = m.user_id AND a.date >= current_date - 30 AND a.status IN ('late','early'))::bigint,
    (SELECT count(*) FROM public.org_watch_flags f WHERE f.organization_id = _org
      AND f.student_id = m.user_id AND NOT f.resolved)::bigint,
    (SELECT count(*) FROM public.org_health_visits h WHERE h.organization_id = _org
      AND h.student_id = m.user_id AND h.visited_at >= now() - interval '30 days')::bigint
  FROM public.organization_members m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  LEFT JOIN public.org_profiles op ON op.user_id = m.user_id AND op.organization_id = _org
  WHERE m.organization_id = _org
  ORDER BY 4 ASC;
END; $function$;

REVOKE ALL ON FUNCTION public.org_monitor_overview(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.org_monitor_overview(uuid) TO authenticated;
