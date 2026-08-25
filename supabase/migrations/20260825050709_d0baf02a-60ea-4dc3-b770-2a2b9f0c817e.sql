CREATE OR REPLACE FUNCTION public.is_study_room_member(_room uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_room_members m WHERE m.room_id = _room AND m.user_id = _user)
      OR EXISTS (SELECT 1 FROM public.group_rooms r WHERE r.id = _room AND r.owner_id = _user)
$$;

REVOKE EXECUTE ON FUNCTION public.is_study_room_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_study_room_member(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "grm_read" ON public.group_room_members;
CREATE POLICY "grm_read" ON public.group_room_members
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_study_room_member(room_id, auth.uid())
);

DROP POLICY IF EXISTS "view all likes" ON public.makron_question_likes;
CREATE POLICY "own likes select" ON public.makron_question_likes
FOR SELECT TO authenticated
USING (auth.uid() = user_id);