ALTER TABLE public.badges
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#00C9B7',
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS available_from timestamptz,
  ADD COLUMN IF NOT EXISTS available_until timestamptz,
  ADD COLUMN IF NOT EXISTS is_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS how_to_earn text,
  ADD COLUMN IF NOT EXISTS created_by uuid;

ALTER TABLE public.user_badges
  ADD COLUMN IF NOT EXISTS granted_by uuid,
  ADD COLUMN IF NOT EXISTS note text;

CREATE UNIQUE INDEX IF NOT EXISTS user_badges_user_code_uniq ON public.user_badges(user_id, badge_code);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_badges TO authenticated;
GRANT ALL ON public.user_badges TO service_role;
DROP POLICY IF EXISTS "own badge insert" ON public.user_badges;
CREATE POLICY "user_badges_admin_insert" ON public.user_badges FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_badges_admin_delete" ON public.user_badges FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS avatar_type text NOT NULL DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS avatar_config jsonb,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS status_message text,
  ADD COLUMN IF NOT EXISTS pinned_badge_codes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS study_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS privacy_online text NOT NULL DEFAULT 'friends',
  ADD COLUMN IF NOT EXISTS privacy_activity text NOT NULL DEFAULT 'simple',
  ADD COLUMN IF NOT EXISTS privacy_stats text NOT NULL DEFAULT 'friends';

CREATE TABLE public.dashboard_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  image_url text NOT NULL,
  action_type text NOT NULL DEFAULT 'none',
  link_url text,
  open_new_tab boolean NOT NULL DEFAULT false,
  modal_title text,
  modal_body text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_banners TO authenticated;
GRANT ALL ON public.dashboard_banners TO service_role;
ALTER TABLE public.dashboard_banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "banners_read" ON public.dashboard_banners FOR SELECT TO authenticated
  USING ((is_active AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now())) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "banners_admin" ON public.dashboard_banners FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.can_see_level(_viewer uuid, _owner uuid, _level text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _viewer = _owner OR _level = 'public'
    OR (_level IN ('friends','detailed','simple') AND EXISTS (
      SELECT 1 FROM public.follows f WHERE f.status='accepted'
        AND ((f.follower_id=_viewer AND f.following_id=_owner) OR (f.follower_id=_owner AND f.following_id=_viewer))))
$$;

CREATE OR REPLACE FUNCTION public.profile_card(_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  p record;
  rel text := 'none';
  show_stats boolean;
  stats jsonb := null;
  badges jsonb;
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
    'joined_at', p.created_at, 'relation', rel, 'stats', stats, 'badges', badges);
END $$;
GRANT EXECUTE ON FUNCTION public.profile_card(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_see_level(uuid,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_grant_badge(_code text, _usernames text[], _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE granted int := 0; missing text[] := '{}'; u text; uid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM badges WHERE code=_code) THEN RAISE EXCEPTION 'badge not found'; END IF;
  FOREACH u IN ARRAY _usernames LOOP
    u := lower(trim(both from regexp_replace(u, '^@', '')));
    CONTINUE WHEN u = '';
    SELECT id INTO uid FROM profiles WHERE lower(username) = u;
    IF uid IS NULL THEN missing := array_append(missing, u); CONTINUE; END IF;
    INSERT INTO user_badges(user_id, badge_code, granted_by, note) VALUES (uid, _code, auth.uid(), _note)
      ON CONFLICT (user_id, badge_code) DO NOTHING;
    IF FOUND THEN granted := granted + 1; END IF;
    uid := NULL;
  END LOOP;
  RETURN jsonb_build_object('granted', granted, 'missing', missing);
END $$;
GRANT EXECUTE ON FUNCTION public.admin_grant_badge(text, text[], text) TO authenticated;