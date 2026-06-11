
-- ===== Makron tables =====
CREATE TABLE public.makron_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subject text,
  field text,
  unit text,
  description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  order_idx int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.makron_units TO authenticated;
GRANT ALL ON public.makron_units TO service_role;
ALTER TABLE public.makron_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY mu_select ON public.makron_units FOR SELECT TO authenticated USING (true);
CREATE POLICY mu_admin_ins ON public.makron_units FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY mu_admin_upd ON public.makron_units FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY mu_admin_del ON public.makron_units FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.makron_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.makron_units(id) ON DELETE CASCADE,
  order_idx int NOT NULL DEFAULT 100,
  prompt text NOT NULL,
  image_url text,
  type text NOT NULL CHECK (type IN ('single','multi','text','written','file')),
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_options jsonb NOT NULL DEFAULT '[]'::jsonb,
  accepted_answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  model_answer text,
  explanation text,
  points int NOT NULL DEFAULT 10,
  grading text NOT NULL DEFAULT 'auto' CHECK (grading IN ('auto','manual')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.makron_questions TO authenticated;
GRANT ALL ON public.makron_questions TO service_role;
ALTER TABLE public.makron_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY mq_select ON public.makron_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY mq_admin_ins ON public.makron_questions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY mq_admin_upd ON public.makron_questions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY mq_admin_del ON public.makron_questions FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.makron_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.makron_units(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  scratchpad text,
  total_score int,
  total_points int,
  xp_awarded int NOT NULL DEFAULT 0,
  coins_awarded int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.makron_sessions TO authenticated;
GRANT ALL ON public.makron_sessions TO service_role;
ALTER TABLE public.makron_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY ms_own ON public.makron_sessions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY ms_admin_read ON public.makron_sessions FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.makron_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.makron_sessions(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.makron_questions(id) ON DELETE CASCADE,
  answer jsonb,
  file_url text,
  auto_correct boolean,
  manual_score int,
  manual_comment text,
  awarded_points int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, question_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.makron_answers TO authenticated;
GRANT ALL ON public.makron_answers TO service_role;
ALTER TABLE public.makron_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY ma_own ON public.makron_answers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.makron_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.makron_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()));
CREATE POLICY ma_admin ON public.makron_answers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.makron_xp (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  xp int NOT NULL DEFAULT 0,
  level int NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.makron_xp TO authenticated;
GRANT ALL ON public.makron_xp TO service_role;
ALTER TABLE public.makron_xp ENABLE ROW LEVEL SECURITY;
CREATE POLICY mxp_read_all ON public.makron_xp FOR SELECT TO authenticated USING (true);

CREATE TABLE public.makron_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid REFERENCES public.makron_questions(id) ON DELETE SET NULL,
  category text NOT NULL,
  suggested_answer text,
  note text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.makron_reports TO authenticated;
GRANT ALL ON public.makron_reports TO service_role;
ALTER TABLE public.makron_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY mr_ins ON public.makron_reports FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY mr_own_read ON public.makron_reports FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY mr_admin_upd ON public.makron_reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ===== Battle expansion =====
ALTER TABLE public.quiz_battles
  ADD COLUMN IF NOT EXISTS genre text,
  ADD COLUMN IF NOT EXISTS num_questions int NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS time_taken int;

-- ===== RPC: finalize session, compute scores & award xp/coins =====
CREATE OR REPLACE FUNCTION public.finalize_makron_session(_session_id uuid)
RETURNS TABLE(total_score int, total_points int, xp_awarded int, coins_awarded int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid;
  v_total_points int := 0;
  v_score int := 0;
  v_xp int := 0;
  v_coins int := 0;
  v_correct int := 0;
  v_wrong int := 0;
BEGIN
  SELECT user_id INTO v_user FROM public.makron_sessions WHERE id = _session_id;
  IF v_user IS NULL OR v_user <> auth.uid() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- compute totals; manual ungraded excluded from denominator
  SELECT
    COALESCE(SUM(CASE
      WHEN q.grading='manual' AND a.manual_score IS NULL THEN 0
      ELSE q.points
    END), 0),
    COALESCE(SUM(CASE
      WHEN q.grading='manual' AND a.manual_score IS NOT NULL THEN a.manual_score
      WHEN q.grading='auto' AND a.auto_correct THEN q.points
      ELSE 0
    END), 0),
    COALESCE(SUM(CASE WHEN (q.grading='auto' AND a.auto_correct) OR (q.grading='manual' AND a.manual_score IS NOT NULL AND a.manual_score >= q.points) THEN 1 ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN (q.grading='auto' AND a.auto_correct = false) THEN 1 ELSE 0 END),0)
  INTO v_total_points, v_score, v_correct, v_wrong
  FROM public.makron_answers a
  JOIN public.makron_questions q ON q.id = a.question_id
  WHERE a.session_id = _session_id;

  v_xp := v_correct * 10 + v_wrong * 2;
  v_coins := v_correct * 2;

  UPDATE public.makron_sessions
    SET finished_at = COALESCE(finished_at, now()),
        total_score = v_score,
        total_points = v_total_points,
        xp_awarded = v_xp,
        coins_awarded = v_coins
  WHERE id = _session_id;

  INSERT INTO public.makron_xp(user_id, xp, level)
    VALUES (v_user, v_xp, GREATEST(1, floor(sqrt(v_xp::numeric/50))::int + 1))
    ON CONFLICT (user_id) DO UPDATE
    SET xp = public.makron_xp.xp + EXCLUDED.xp,
        level = GREATEST(1, floor(sqrt((public.makron_xp.xp + EXCLUDED.xp)::numeric/50))::int + 1),
        updated_at = now();

  IF v_coins > 0 THEN
    INSERT INTO public.user_coins(user_id, balance, total_earned)
      VALUES (v_user, v_coins, v_coins)
      ON CONFLICT (user_id) DO UPDATE
      SET balance = public.user_coins.balance + EXCLUDED.balance,
          total_earned = public.user_coins.total_earned + EXCLUDED.total_earned,
          updated_at = now();
  END IF;

  RETURN QUERY SELECT v_score, v_total_points, v_xp, v_coins;
END $$;

GRANT EXECUTE ON FUNCTION public.finalize_makron_session(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_makron_leaderboard(_limit int DEFAULT 20)
RETURNS TABLE(user_id uuid, display_name text, avatar_url text, xp int, level int, rank bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT x.user_id, p.display_name, p.avatar_url, x.xp, x.level,
    RANK() OVER (ORDER BY x.xp DESC) AS rank
  FROM public.makron_xp x
  JOIN public.profiles p ON p.id = x.user_id
  ORDER BY x.xp DESC
  LIMIT _limit
$$;
GRANT EXECUTE ON FUNCTION public.get_makron_leaderboard(int) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_makron_rank()
RETURNS TABLE(xp int, level int, rank bigint, total_users bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ranked AS (
    SELECT user_id, xp, level, RANK() OVER (ORDER BY xp DESC) AS rank FROM public.makron_xp
  ), tot AS (SELECT COUNT(*) AS c FROM public.makron_xp)
  SELECT COALESCE(r.xp,0), COALESCE(r.level,1), COALESCE(r.rank, 0), tot.c
  FROM tot LEFT JOIN ranked r ON r.user_id = auth.uid()
$$;
GRANT EXECUTE ON FUNCTION public.get_my_makron_rank() TO authenticated;

-- updated_at triggers
CREATE TRIGGER trg_mu_upd BEFORE UPDATE ON public.makron_units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_mq_upd BEFORE UPDATE ON public.makron_questions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ma_upd BEFORE UPDATE ON public.makron_answers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
