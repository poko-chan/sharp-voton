REVOKE ALL ON FUNCTION public.is_meeting_participant(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_meeting_participant(uuid, uuid) TO authenticated;