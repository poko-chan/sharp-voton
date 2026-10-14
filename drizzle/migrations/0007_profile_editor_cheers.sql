GRANT SELECT (banner_url, avatar_type, avatar_config, bio, status_message, pinned_badge_codes, study_tags, privacy_online, privacy_activity, privacy_stats) ON public.profiles TO authenticated;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_title text,
  ADD COLUMN IF NOT EXISTS profile_frame text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS goal_text text,
  ADD COLUMN IF NOT EXISTS goal_date date;
GRANT SELECT (profile_title, profile_frame, goal_text, goal_date) ON public.profiles TO authenticated;
GRANT UPDATE (profile_title, profile_frame, goal_text, goal_date) ON public.profiles TO authenticated;

CREATE TABLE IF NOT EXISTS public.profile_cheers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user uuid NOT NULL,
  to_user uuid NOT NULL,
  kind text NOT NULL,
  message text,
  created_on date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_user, to_user, kind, created_on)
);
GRANT SELECT, DELETE ON public.profile_cheers TO authenticated;
GRANT ALL ON public.profile_cheers TO service_role;
ALTER TABLE public.profile_cheers ENABLE ROW LEVEL SECURITY;
CREATE POLICY cheers_select_own ON public.profile_cheers FOR SELECT TO authenticated
  USING (from_user = auth.uid() OR to_user = auth.uid());
CREATE POLICY cheers_delete_own ON public.profile_cheers FOR DELETE TO authenticated
  USING (from_user = auth.uid());

CREATE OR REPLACE FUNCTION public.send_profile_cheer(_to uuid, _kind text, _message text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL OR me = _to THEN RAISE EXCEPTION 'invalid'; END IF;
  IF _kind NOT IN ('fight','nice','otsukare','sugoi','issho') THEN RAISE EXCEPTION 'invalid kind'; END IF;
  IF NOT EXISTS (SELECT 1 FROM follows WHERE status='accepted' AND ((follower_id=me AND following_id=_to) OR (follower_id=_to AND following_id=me))) THEN
    RAISE EXCEPTION 'フレンドにだけエールを送れます';
  END IF;
  INSERT INTO profile_cheers(from_user, to_user, kind, message)
  VALUES (me, _to, _kind, NULLIF(left(trim(coalesce(_message,'')), 80), ''))
  ON CONFLICT (from_user, to_user, kind, created_on) DO UPDATE SET message = EXCLUDED.message, created_at = now();
END $$;
REVOKE ALL ON FUNCTION public.send_profile_cheer(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.send_profile_cheer(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.profile_card_extra(_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  p record;
  rel_ok boolean;
  streak int := 0;
  d date := current_date;
  cheers jsonb;
  mine jsonb;
  msgs jsonb;
BEGIN
  IF me IS NULL THEN RETURN NULL; END IF;
  SELECT profile_title, profile_frame, goal_text, goal_date, privacy_stats INTO p FROM profiles WHERE id = _id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM follows WHERE status='blocked' AND ((follower_id=me AND following_id=_id) OR (follower_id=_id AND following_id=me))) THEN
    RETURN NULL;
  END IF;
  rel_ok := me = _id OR EXISTS (SELECT 1 FROM follows WHERE status='accepted' AND ((follower_id=me AND following_id=_id) OR (follower_id=_id AND following_id=me)));
  IF NOT EXISTS (SELECT 1 FROM study_logs WHERE user_id=_id AND date=d) THEN d := d - 1; END IF;
  WHILE EXISTS (SELECT 1 FROM study_logs WHERE user_id=_id AND date=d) AND streak < 1000 LOOP
    streak := streak + 1; d := d - 1;
  END LOOP;
  SELECT COALESCE(jsonb_object_agg(kind, c), '{}'::jsonb) INTO cheers FROM (SELECT kind, count(*) c FROM profile_cheers WHERE to_user=_id GROUP BY kind) t;
  SELECT COALESCE(jsonb_agg(kind), '[]'::jsonb) INTO mine FROM profile_cheers WHERE from_user=me AND to_user=_id AND created_on=current_date;
  IF rel_ok THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('name', COALESCE(pr.display_name, pr.username), 'message', c.message, 'at', c.created_at) ORDER BY c.created_at DESC), '[]'::jsonb)
      INTO msgs FROM (SELECT * FROM profile_cheers WHERE to_user=_id AND message IS NOT NULL ORDER BY created_at DESC LIMIT 5) c
      JOIN profiles pr ON pr.id = c.from_user;
  ELSE msgs := '[]'::jsonb; END IF;
  RETURN jsonb_build_object(
    'title', p.profile_title, 'frame', p.profile_frame,
    'goal_text', p.goal_text, 'goal_date', p.goal_date,
    'streak', CASE WHEN me=_id OR p.privacy_stats='public' OR (p.privacy_stats='friends' AND rel_ok) THEN streak ELSE NULL END,
    'cheers', cheers, 'my_cheers_today', mine, 'messages', msgs);
END $$;
REVOKE ALL ON FUNCTION public.profile_card_extra(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.profile_card_extra(uuid) TO authenticated;