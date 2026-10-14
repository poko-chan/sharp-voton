CREATE OR REPLACE FUNCTION public.profile_card(_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  p record;
  rel text := 'none';
  show_stats boolean;
  stats jsonb := null;
  badges jsonb;
  weekly_goal jsonb := null;
  current_week_start date := current_date - ((extract(isodow from current_date)::int - 1));
BEGIN
  IF me IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO p FROM public.profiles WHERE id = _id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF me = _id THEN rel := 'self';
  ELSIF EXISTS (SELECT 1 FROM follows WHERE follower_id=_id AND following_id=me AND status='blocked')
     OR EXISTS (SELECT 1 FROM follows WHERE follower_id=me AND following_id=_id AND status='blocked') THEN rel := 'blocked';
  ELSIF EXISTS (SELECT 1 FROM follows WHERE status='accepted' AND ((follower_id=me AND following_id=_id) OR (follower_id=_id AND following_id=me))) THEN rel := 'friend';
  ELSIF EXISTS (SELECT 1 FROM follows WHERE follower_id=me AND following_id=_id AND status='pending') THEN rel := 'outgoing';
  ELSIF EXISTS (SELECT 1 FROM follows WHERE follower_id=_id AND following_id=me AND status='pending') THEN rel := 'incoming';
  END IF;

  show_stats := rel = 'self' OR p.privacy_stats = 'public' OR (p.privacy_stats = 'friends' AND rel = 'friend');
  IF show_stats AND rel <> 'blocked' THEN
    SELECT jsonb_build_object(
      'total_minutes', COALESCE((SELECT sum(duration_minutes) FROM study_logs WHERE user_id=_id),0),
      'week_minutes', COALESCE((SELECT sum(duration_minutes) FROM study_logs WHERE user_id=_id AND date >= current_date - 6),0),
      'month_days', COALESCE((SELECT count(DISTINCT date) FROM study_logs WHERE user_id=_id AND date >= current_date - 29),0),
      'heat', COALESCE((SELECT jsonb_agg(jsonb_build_object('d', d, 'm', m) ORDER BY d) FROM (
          SELECT date d, sum(duration_minutes) m FROM study_logs WHERE user_id=_id AND date >= current_date - 29 GROUP BY date) h), '[]'::jsonb),
      'top_subjects', COALESCE((SELECT jsonb_agg(x) FROM (
          SELECT jsonb_build_object('name', s.name, 'color', s.color, 'm', sum(l.duration_minutes)) x
          FROM study_logs l JOIN subjects s ON s.id = l.subject_id
          WHERE l.user_id=_id AND l.date >= current_date - 29
          GROUP BY s.name, s.color ORDER BY sum(l.duration_minutes) DESC LIMIT 3) t), '[]'::jsonb),
      'top_materials', COALESCE((SELECT jsonb_agg(x) FROM (
          SELECT jsonb_build_object('name', m.title, 'm', sum(l.duration_minutes)) x
          FROM study_logs l JOIN materials m ON m.id = l.material_id
          WHERE l.user_id=_id
          GROUP BY m.title ORDER BY sum(l.duration_minutes) DESC LIMIT 3) t), '[]'::jsonb)
    ) INTO stats;
  END IF;

  IF rel = 'self' OR (rel = 'friend' AND EXISTS (
    SELECT 1 FROM public.fr_pledges fp
    WHERE fp.user_id = _id AND fp.week_start = current_week_start AND fp.shared
  )) THEN
    SELECT jsonb_build_object(
      'target_minutes', fp.target_minutes,
      'note', fp.note,
      'week_minutes', COALESCE((SELECT sum(duration_minutes) FROM study_logs WHERE user_id = _id AND date >= current_week_start), 0),
      'shared', fp.shared
    ) INTO weekly_goal
    FROM public.fr_pledges fp
    WHERE fp.user_id = _id AND fp.week_start = current_week_start
    LIMIT 1;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'code', b.code, 'name', b.name, 'description', b.description, 'icon', b.icon,
      'color', b.color, 'image_url', b.image_url, 'how_to_earn', b.how_to_earn,
      'available_from', b.available_from, 'available_until', b.available_until,
      'earned_at', ub.earned_at) ORDER BY ub.earned_at DESC NULLS LAST, b.created_at), '[]'::jsonb)
    INTO badges
  FROM badges b
  LEFT JOIN user_badges ub ON ub.badge_code = b.code AND ub.user_id = _id
  WHERE b.code <> 'coin_1000' AND (ub.id IS NOT NULL OR NOT b.is_hidden);

  RETURN jsonb_build_object(
    'id', p.id, 'username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url,
    'banner_url', p.banner_url, 'avatar_type', p.avatar_type, 'avatar_config', p.avatar_config,
    'bio', CASE WHEN rel='blocked' THEN null ELSE p.bio END,
    'status_message', CASE WHEN rel='blocked' THEN null ELSE p.status_message END,
    'pinned_badge_codes', p.pinned_badge_codes, 'study_tags', p.study_tags,
    'privacy_online', p.privacy_online, 'privacy_activity', p.privacy_activity, 'privacy_stats', p.privacy_stats,
    'joined_at', p.created_at, 'relation', rel, 'stats', stats, 'weekly_goal', weekly_goal, 'badges', badges);
END $$;
GRANT EXECUTE ON FUNCTION public.profile_card(uuid) TO authenticated;
