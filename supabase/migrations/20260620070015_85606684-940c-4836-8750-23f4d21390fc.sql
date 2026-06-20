
CREATE TABLE IF NOT EXISTS public.makron_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.makron_units(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_official boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  shuffle boolean NOT NULL DEFAULT false,
  question_limit integer,
  allow_all_mode boolean NOT NULL DEFAULT true,
  skip_preview boolean NOT NULL DEFAULT false,
  max_attempts integer,
  pass_score integer,
  xp_per_question integer NOT NULL DEFAULT 10,
  coin_per_question integer NOT NULL DEFAULT 1,
  xp_cap_per_user integer,
  coin_cap_per_user integer,
  reward_attempts_cap integer,
  is_active boolean NOT NULL DEFAULT true,
  order_idx integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.makron_packs TO authenticated;
GRANT ALL ON public.makron_packs TO service_role;
ALTER TABLE public.makron_packs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "packs read approved or own or admin" ON public.makron_packs;
CREATE POLICY "packs read approved or own or admin" ON public.makron_packs FOR SELECT TO authenticated
  USING (status='approved' OR created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "packs insert anyone" ON public.makron_packs;
CREATE POLICY "packs insert anyone" ON public.makron_packs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "packs update own or admin" ON public.makron_packs;
CREATE POLICY "packs update own or admin" ON public.makron_packs FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "packs delete own or admin" ON public.makron_packs;
CREATE POLICY "packs delete own or admin" ON public.makron_packs FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS makron_packs_unit_idx ON public.makron_packs(unit_id);
CREATE INDEX IF NOT EXISTS makron_packs_creator_idx ON public.makron_packs(created_by);

CREATE OR REPLACE FUNCTION public.makron_pack_set_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  IF public.has_role(auth.uid(),'admin') THEN
    NEW.status := COALESCE(NEW.status, 'approved');
    IF NEW.is_official IS NULL THEN NEW.is_official := true; END IF;
  ELSE
    NEW.status := 'pending';
    NEW.is_official := false;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS makron_pack_set_status_trg ON public.makron_packs;
CREATE TRIGGER makron_pack_set_status_trg BEFORE INSERT ON public.makron_packs
  FOR EACH ROW EXECUTE FUNCTION public.makron_pack_set_status();

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS makron_packs_updated_at ON public.makron_packs;
CREATE TRIGGER makron_packs_updated_at BEFORE UPDATE ON public.makron_packs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.makron_questions
  ADD COLUMN IF NOT EXISTS pack_id uuid REFERENCES public.makron_packs(id) ON DELETE CASCADE;

DO $$
DECLARE u RECORD; new_pack uuid;
BEGIN
  FOR u IN SELECT DISTINCT mu.id, mu.title FROM public.makron_units mu
           WHERE EXISTS (SELECT 1 FROM public.makron_questions q WHERE q.unit_id = mu.id AND q.pack_id IS NULL)
  LOOP
    INSERT INTO public.makron_packs(unit_id, title, description, is_official, status)
    VALUES (u.id, COALESCE(u.title,'') || ' - デフォルト', '既存問題の自動パック', true, 'approved')
    RETURNING id INTO new_pack;
    UPDATE public.makron_questions SET pack_id = new_pack WHERE unit_id = u.id AND pack_id IS NULL;
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS public.makron_pack_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pack_id uuid NOT NULL REFERENCES public.makron_packs(id) ON DELETE CASCADE,
  attempts_count integer NOT NULL DEFAULT 0,
  rewards_granted_count integer NOT NULL DEFAULT 0,
  xp_earned_total integer NOT NULL DEFAULT 0,
  coins_earned_total integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, pack_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.makron_pack_attempts TO authenticated;
GRANT ALL ON public.makron_pack_attempts TO service_role;
ALTER TABLE public.makron_pack_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "attempts read own or pack owner or admin" ON public.makron_pack_attempts;
CREATE POLICY "attempts read own or pack owner or admin" ON public.makron_pack_attempts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin')
         OR EXISTS(SELECT 1 FROM public.makron_packs p WHERE p.id = pack_id AND p.created_by = auth.uid()));
DROP POLICY IF EXISTS "attempts upsert own" ON public.makron_pack_attempts;
CREATE POLICY "attempts upsert own" ON public.makron_pack_attempts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "attempts update own or pack owner or admin" ON public.makron_pack_attempts;
CREATE POLICY "attempts update own or pack owner or admin" ON public.makron_pack_attempts FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin')
         OR EXISTS(SELECT 1 FROM public.makron_packs p WHERE p.id = pack_id AND p.created_by = auth.uid()));

ALTER TABLE public.makron_sessions
  ADD COLUMN IF NOT EXISTS pack_id uuid REFERENCES public.makron_packs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS all_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS passed boolean;

CREATE OR REPLACE FUNCTION public.makron_pack_stats(_pack_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb; is_owner boolean;
BEGIN
  SELECT (created_by = auth.uid()) OR public.has_role(auth.uid(),'admin')
    INTO is_owner FROM public.makron_packs WHERE id = _pack_id;
  IF NOT COALESCE(is_owner,false) THEN RAISE EXCEPTION 'forbidden'; END IF;
  WITH q AS (SELECT id, points FROM public.makron_questions WHERE pack_id = _pack_id),
       sess AS (SELECT s.id, s.user_id, s.total_score AS score, s.total_points, s.passed, s.started_at, s.finished_at AS completed_at
                FROM public.makron_sessions s WHERE s.pack_id = _pack_id),
       ans AS (SELECT a.* FROM public.makron_answers a JOIN sess ON a.session_id = sess.id)
  SELECT jsonb_build_object(
    'questions_count', (SELECT count(*) FROM q),
    'total_points', (SELECT COALESCE(SUM(points),0) FROM q),
    'sessions_count', (SELECT count(*) FROM sess),
    'completed_sessions', (SELECT count(*) FROM sess WHERE completed_at IS NOT NULL),
    'unique_users', (SELECT count(DISTINCT user_id) FROM sess),
    'pass_count', (SELECT count(*) FROM sess WHERE passed = true),
    'fail_count', (SELECT count(*) FROM sess WHERE passed = false),
    'pass_rate', CASE WHEN (SELECT count(*) FROM sess WHERE completed_at IS NOT NULL)=0 THEN 0
                      ELSE ROUND(100.0 * (SELECT count(*) FROM sess WHERE passed=true)::numeric /
                           NULLIF((SELECT count(*) FROM sess WHERE completed_at IS NOT NULL),0), 1) END,
    'max_score', (SELECT COALESCE(MAX(score),0) FROM sess WHERE completed_at IS NOT NULL),
    'min_score', (SELECT COALESCE(MIN(score),0) FROM sess WHERE completed_at IS NOT NULL),
    'avg_score', (SELECT COALESCE(ROUND(AVG(score)::numeric, 1), 0) FROM sess WHERE completed_at IS NOT NULL),
    'median_score', (SELECT COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY score), 0) FROM sess WHERE completed_at IS NOT NULL),
    'answers_count', (SELECT count(*) FROM ans),
    'correct_answers', (SELECT count(*) FROM ans WHERE is_correct = true),
    'accuracy_rate', CASE WHEN (SELECT count(*) FROM ans WHERE is_correct IS NOT NULL)=0 THEN 0
                          ELSE ROUND(100.0 * (SELECT count(*) FROM ans WHERE is_correct=true)::numeric /
                               NULLIF((SELECT count(*) FROM ans WHERE is_correct IS NOT NULL),0), 1) END,
    'avg_duration_sec', (SELECT COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - started_at)))::numeric, 0), 0)
                         FROM sess WHERE completed_at IS NOT NULL),
    'last_activity', (SELECT MAX(started_at) FROM sess)
  ) INTO v;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.makron_pack_attempters(_pack_id uuid)
RETURNS TABLE(user_id uuid, display_name text, attempts_count int, best_score int, last_attempt_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT a.user_id,
         p.display_name,
         a.attempts_count,
         COALESCE((SELECT MAX(s.total_score) FROM public.makron_sessions s
                   WHERE s.pack_id = _pack_id AND s.user_id = a.user_id), 0)::int,
         a.last_attempt_at
  FROM public.makron_pack_attempts a
  LEFT JOIN public.profiles p ON p.id = a.user_id
  WHERE a.pack_id = _pack_id
    AND EXISTS(SELECT 1 FROM public.makron_packs k WHERE k.id = _pack_id
               AND (k.created_by = auth.uid() OR public.has_role(auth.uid(),'admin')))
  ORDER BY a.last_attempt_at DESC NULLS LAST;
$$;

CREATE OR REPLACE FUNCTION public.makron_pack_reset_attempts(_pack_id uuid, _user_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.makron_packs WHERE id = _pack_id
                AND (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'))) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _user_id IS NULL THEN
    UPDATE public.makron_pack_attempts SET attempts_count = 0, rewards_granted_count = 0 WHERE pack_id = _pack_id;
  ELSE
    UPDATE public.makron_pack_attempts SET attempts_count = 0, rewards_granted_count = 0
      WHERE pack_id = _pack_id AND user_id = _user_id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.makron_update_answer_score(_answer_id uuid, _score int, _is_correct boolean, _comment text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pack uuid;
BEGIN
  SELECT q.pack_id INTO v_pack FROM public.makron_answers a
    JOIN public.makron_questions q ON q.id = a.question_id WHERE a.id = _answer_id;
  IF v_pack IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.makron_packs WHERE id = v_pack
                AND (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'))) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.makron_answers
     SET manual_score = _score,
         is_correct = COALESCE(_is_correct, is_correct),
         manual_comment = COALESCE(_comment, manual_comment),
         graded_at = now(), graded_by = auth.uid()
   WHERE id = _answer_id;
END $$;

CREATE OR REPLACE FUNCTION public.makron_delete_answer(_answer_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pack uuid;
BEGIN
  SELECT q.pack_id INTO v_pack FROM public.makron_answers a
    JOIN public.makron_questions q ON q.id = a.question_id WHERE a.id = _answer_id;
  IF NOT EXISTS(SELECT 1 FROM public.makron_packs WHERE id = v_pack
                AND (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'))) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  DELETE FROM public.makron_answers WHERE id = _answer_id;
END $$;

CREATE OR REPLACE FUNCTION public.makron_update_session(_session_id uuid, _score int, _passed boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pack uuid;
BEGIN
  SELECT pack_id INTO v_pack FROM public.makron_sessions WHERE id = _session_id;
  IF NOT EXISTS(SELECT 1 FROM public.makron_packs WHERE id = v_pack
                AND (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'))) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.makron_sessions SET total_score = _score, passed = _passed WHERE id = _session_id;
END $$;

COMMENT ON TABLE public.makron_packs IS 'Makron 問題パック（単元配下、一般作成可・管理者承認で公式化）';
