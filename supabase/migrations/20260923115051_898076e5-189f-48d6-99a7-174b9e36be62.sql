CREATE TABLE public.fr_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL,
  name text NOT NULL,
  join_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fr_rooms TO authenticated;
GRANT ALL ON public.fr_rooms TO service_role;
ALTER TABLE public.fr_rooms ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.fr_room_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.fr_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  minutes integer NOT NULL DEFAULT 0,
  focus_until timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fr_room_members TO authenticated;
GRANT ALL ON public.fr_room_members TO service_role;
ALTER TABLE public.fr_room_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_fr_room_member(_room uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.fr_room_members m WHERE m.room_id = _room AND m.user_id = _user);
$$;

CREATE POLICY "rooms_select" ON public.fr_rooms FOR SELECT TO authenticated
  USING (host_id = auth.uid() OR public.is_fr_room_member(id, auth.uid()) OR status = 'open');
CREATE POLICY "rooms_insert" ON public.fr_rooms FOR INSERT TO authenticated
  WITH CHECK (host_id = auth.uid());
CREATE POLICY "rooms_update" ON public.fr_rooms FOR UPDATE TO authenticated
  USING (host_id = auth.uid()) WITH CHECK (host_id = auth.uid());
CREATE POLICY "rooms_delete" ON public.fr_rooms FOR DELETE TO authenticated
  USING (host_id = auth.uid());

CREATE POLICY "room_members_select" ON public.fr_room_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_fr_room_member(room_id, auth.uid()));
CREATE POLICY "room_members_insert" ON public.fr_room_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "room_members_update" ON public.fr_room_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "room_members_delete" ON public.fr_room_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE public.fr_cheers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user uuid NOT NULL,
  to_user uuid NOT NULL,
  emoji text NOT NULL DEFAULT '👏',
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.fr_cheers TO authenticated;
GRANT ALL ON public.fr_cheers TO service_role;
ALTER TABLE public.fr_cheers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cheers_select" ON public.fr_cheers FOR SELECT TO authenticated
  USING (from_user = auth.uid() OR to_user = auth.uid());
CREATE POLICY "cheers_insert" ON public.fr_cheers FOR INSERT TO authenticated
  WITH CHECK (from_user = auth.uid());
CREATE POLICY "cheers_delete" ON public.fr_cheers FOR DELETE TO authenticated
  USING (from_user = auth.uid());

CREATE TABLE public.fr_pledges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  week_start date NOT NULL,
  target_minutes integer NOT NULL DEFAULT 300,
  note text,
  shared boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fr_pledges TO authenticated;
GRANT ALL ON public.fr_pledges TO service_role;
ALTER TABLE public.fr_pledges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pledges_select" ON public.fr_pledges FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (shared AND public.are_mutual_friends(auth.uid(), user_id)));
CREATE POLICY "pledges_write" ON public.fr_pledges FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.friend_weekly_ranking(_week_start date)
RETURNS TABLE (user_id uuid, minutes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.user_id, COALESCE(SUM(l.duration_minutes), 0)::bigint AS minutes
  FROM public.study_logs l
  WHERE l.date >= _week_start
    AND l.date < _week_start + 7
    AND (l.user_id = auth.uid() OR public.are_mutual_friends(auth.uid(), l.user_id))
  GROUP BY l.user_id
  ORDER BY minutes DESC;
$$;
GRANT EXECUTE ON FUNCTION public.friend_weekly_ranking(date) TO authenticated;

CREATE TRIGGER fr_rooms_updated BEFORE UPDATE ON public.fr_rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER fr_room_members_updated BEFORE UPDATE ON public.fr_room_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER fr_pledges_updated BEFORE UPDATE ON public.fr_pledges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();