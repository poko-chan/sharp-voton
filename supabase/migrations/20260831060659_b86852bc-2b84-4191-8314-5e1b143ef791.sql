CREATE TABLE public.town_buildings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  town_id uuid NOT NULL REFERENCES public.towns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL,
  gx integer NOT NULL,
  gz integer NOT NULL,
  level integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (town_id, gx, gz)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.town_buildings TO authenticated;
GRANT ALL ON public.town_buildings TO service_role;
ALTER TABLE public.town_buildings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own town buildings" ON public.town_buildings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.town_policies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  town_id uuid NOT NULL REFERENCES public.towns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (town_id, key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.town_policies TO authenticated;
GRANT ALL ON public.town_policies TO service_role;
ALTER TABLE public.town_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own town policies" ON public.town_policies FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.town_build(_town_id uuid, _kind text, _gx integer, _gz integer, _cost integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _bal integer;
  _row public.town_buildings;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.towns t WHERE t.id = _town_id AND t.user_id = _uid) THEN
    RAISE EXCEPTION 'town not found';
  END IF;
  IF _cost < 0 OR _cost > 100000 THEN RAISE EXCEPTION 'invalid cost'; END IF;

  INSERT INTO public.user_coins (user_id, balance)
  VALUES (_uid, 0) ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO _bal FROM public.user_coins WHERE user_id = _uid FOR UPDATE;
  IF COALESCE(_bal, 0) < _cost THEN RAISE EXCEPTION 'コインが足りません'; END IF;

  UPDATE public.user_coins SET balance = balance - _cost WHERE user_id = _uid;

  INSERT INTO public.coin_transactions (user_id, amount, reason)
  VALUES (_uid, -_cost, '街の建設: ' || _kind);

  INSERT INTO public.town_buildings (town_id, user_id, kind, gx, gz)
  VALUES (_town_id, _uid, _kind, _gx, _gz)
  RETURNING * INTO _row;

  RETURN json_build_object('building', row_to_json(_row), 'balance', COALESCE(_bal,0) - _cost);
END;
$$;

REVOKE ALL ON FUNCTION public.town_build(uuid, text, integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.town_build(uuid, text, integer, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.town_demolish(_building_id uuid, _refund integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _bal integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _refund < 0 OR _refund > 100000 THEN RAISE EXCEPTION 'invalid refund'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.town_buildings b WHERE b.id = _building_id AND b.user_id = _uid) THEN
    RAISE EXCEPTION 'building not found';
  END IF;

  DELETE FROM public.town_buildings WHERE id = _building_id AND user_id = _uid;

  INSERT INTO public.user_coins (user_id, balance) VALUES (_uid, 0) ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.user_coins SET balance = balance + _refund WHERE user_id = _uid
  RETURNING balance INTO _bal;

  INSERT INTO public.coin_transactions (user_id, amount, reason)
  VALUES (_uid, _refund, '街の解体による返金');

  RETURN json_build_object('balance', _bal);
END;
$$;

REVOKE ALL ON FUNCTION public.town_demolish(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.town_demolish(uuid, integer) TO authenticated;