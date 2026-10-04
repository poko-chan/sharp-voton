CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  host_id uuid NOT NULL,
  password_hash text,
  is_locked boolean NOT NULL DEFAULT false,
  mute_on_entry boolean NOT NULL DEFAULT false,
  allow_screen_share boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
CREATE TABLE public.meeting_participants (
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  kicked boolean NOT NULL DEFAULT false,
  PRIMARY KEY (meeting_id, user_id)
);
CREATE INDEX meeting_participants_user_idx ON public.meeting_participants(user_id, joined_at DESC);

GRANT SELECT ON public.meetings TO authenticated;
GRANT SELECT ON public.meeting_participants TO authenticated;
GRANT ALL ON public.meetings TO service_role;
GRANT ALL ON public.meeting_participants TO service_role;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_meeting_participant(_meeting uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.meeting_participants WHERE meeting_id=_meeting AND user_id=_user AND NOT kicked)
$$;
GRANT EXECUTE ON FUNCTION public.is_meeting_participant(uuid, uuid) TO authenticated;

CREATE POLICY meetings_select ON public.meetings FOR SELECT TO authenticated
  USING (host_id = auth.uid() OR created_by = auth.uid() OR public.is_meeting_participant(id, auth.uid()));
CREATE POLICY meeting_participants_select ON public.meeting_participants FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_meeting_participant(meeting_id, auth.uid()));

REVOKE SELECT (password_hash) ON public.meetings FROM authenticated;

CREATE OR REPLACE FUNCTION public.meeting_public(m public.meetings)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object('id', m.id, 'code', m.code, 'title', m.title, 'host_id', m.host_id,
    'has_password', m.password_hash IS NOT NULL, 'is_locked', m.is_locked,
    'mute_on_entry', m.mute_on_entry, 'allow_screen_share', m.allow_screen_share,
    'status', m.status, 'created_at', m.created_at)
$$;

CREATE OR REPLACE FUNCTION public.create_meeting(_title text, _password text, _mute_on_entry boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _uid uuid := auth.uid(); _code text; _m public.meetings; _i int := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'ログインが必要です'; END IF;
  IF _password IS NOT NULL AND length(_password) > 0 AND length(_password) < 4 THEN
    RAISE EXCEPTION 'パスコードは4文字以上にしてください'; END IF;
  LOOP
    _code := lpad((floor(random()*1000000))::int::text, 6, '0') || lpad((floor(random()*100))::int::text, 2, '0');
    _code := substr(_code, 1, 8);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.meetings WHERE code=_code AND status='active');
    _i := _i + 1; IF _i > 20 THEN RAISE EXCEPTION 'コードを発行できませんでした'; END IF;
  END LOOP;
  DELETE FROM public.meetings WHERE code=_code;
  INSERT INTO public.meetings(code, title, host_id, created_by, password_hash, mute_on_entry)
  VALUES (_code, left(coalesce(nullif(trim(_title),''),'会議'), 80), _uid, _uid,
    CASE WHEN coalesce(_password,'') = '' THEN NULL ELSE crypt(_password, gen_salt('bf')) END,
    coalesce(_mute_on_entry,false))
  RETURNING * INTO _m;
  INSERT INTO public.meeting_participants(meeting_id, user_id) VALUES (_m.id, _uid);
  RETURN public.meeting_public(_m);
END $$;

CREATE OR REPLACE FUNCTION public.join_meeting(_code text, _password text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _uid uuid := auth.uid(); _m public.meetings; _p public.meeting_participants;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'ログインが必要です'; END IF;
  SELECT * INTO _m FROM public.meetings WHERE code = regexp_replace(coalesce(_code,''), '\D', '', 'g') AND status='active';
  IF NOT FOUND THEN RAISE EXCEPTION '会議が見つからないか、終了しています'; END IF;
  SELECT * INTO _p FROM public.meeting_participants WHERE meeting_id=_m.id AND user_id=_uid;
  IF FOUND AND _p.kicked THEN RAISE EXCEPTION 'この会議には参加できません'; END IF;
  IF _m.host_id <> _uid AND NOT FOUND THEN
    IF _m.is_locked THEN RAISE EXCEPTION '主催者が入室を締め切っています'; END IF;
    IF _m.password_hash IS NOT NULL AND (coalesce(_password,'') = '' OR crypt(_password, _m.password_hash) <> _m.password_hash) THEN
      RAISE EXCEPTION 'パスコードが違います'; END IF;
  END IF;
  INSERT INTO public.meeting_participants(meeting_id, user_id) VALUES (_m.id, _uid)
  ON CONFLICT (meeting_id, user_id) DO NOTHING;
  RETURN public.meeting_public(_m);
END $$;

CREATE OR REPLACE FUNCTION public.meeting_host_action(_meeting uuid, _action text, _target uuid, _value boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _m public.meetings;
BEGIN
  SELECT * INTO _m FROM public.meetings WHERE id=_meeting AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '会議が見つかりません'; END IF;
  IF _action = 'claim' THEN
    -- 主催者が切断した時、参加者が主催者を引き継ぐ
    IF NOT public.is_meeting_participant(_meeting, _uid) THEN RAISE EXCEPTION '権限がありません'; END IF;
    UPDATE public.meetings SET host_id=_uid WHERE id=_meeting RETURNING * INTO _m;
    RETURN public.meeting_public(_m);
  END IF;
  IF _m.host_id <> _uid THEN RAISE EXCEPTION '主催者のみ操作できます'; END IF;
  IF _action = 'transfer' THEN
    IF NOT public.is_meeting_participant(_meeting, _target) THEN RAISE EXCEPTION '相手が参加していません'; END IF;
    UPDATE public.meetings SET host_id=_target WHERE id=_meeting RETURNING * INTO _m;
  ELSIF _action = 'lock' THEN UPDATE public.meetings SET is_locked=coalesce(_value,false) WHERE id=_meeting RETURNING * INTO _m;
  ELSIF _action = 'mute_on_entry' THEN UPDATE public.meetings SET mute_on_entry=coalesce(_value,false) WHERE id=_meeting RETURNING * INTO _m;
  ELSIF _action = 'screen_share' THEN UPDATE public.meetings SET allow_screen_share=coalesce(_value,true) WHERE id=_meeting RETURNING * INTO _m;
  ELSIF _action = 'kick' THEN
    IF _target = _uid THEN RAISE EXCEPTION '自分は退出させられません'; END IF;
    UPDATE public.meeting_participants SET kicked=true WHERE meeting_id=_meeting AND user_id=_target;
  ELSIF _action = 'end' THEN UPDATE public.meetings SET status='ended', ended_at=now() WHERE id=_meeting RETURNING * INTO _m;
  ELSE RAISE EXCEPTION '不明な操作です'; END IF;
  RETURN public.meeting_public(_m);
END $$;

REVOKE ALL ON FUNCTION public.create_meeting(text,text,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_meeting(text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.meeting_host_action(uuid,text,uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_meeting(text,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_meeting(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.meeting_host_action(uuid,text,uuid,boolean) TO authenticated;