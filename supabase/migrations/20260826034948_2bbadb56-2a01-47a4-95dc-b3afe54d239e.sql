-- 1) assignments.quiz_answer_key を列単位で非公開に
REVOKE SELECT ON public.assignments FROM authenticated, anon;
GRANT SELECT (id, class_id, created_by, title, description, due_at, max_points, xp_mode, fixed_xp, attachments, allowed_file_types, kind, quiz_questions, created_at, updated_at) ON public.assignments TO authenticated;

-- 2) submissions: 採点系カラムは先生/管理者のみ
CREATE OR REPLACE FUNCTION public.submissions_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_staff boolean;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  v_staff := public.can_view_submission(NEW.assignment_id, auth.uid())
             OR public.has_role(auth.uid(), 'admin'::app_role);

  IF TG_OP = 'INSERT' THEN
    IF NOT v_staff THEN
      NEW.score := NULL;
      NEW.graded_at := NULL;
      NEW.feedback := NULL;
      NEW.xp_awarded := COALESCE((
        SELECT CASE WHEN a.xp_mode = 'fixed' THEN a.fixed_xp ELSE 0 END
        FROM public.assignments a WHERE a.id = NEW.assignment_id
      ), 0);
    END IF;
    RETURN NEW;
  END IF;

  IF NOT v_staff THEN
    NEW.score := OLD.score;
    NEW.graded_at := OLD.graded_at;
    NEW.feedback := OLD.feedback;
    NEW.xp_awarded := OLD.xp_awarded;
    NEW.user_id := OLD.user_id;
    NEW.assignment_id := OLD.assignment_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS submissions_guard_trg ON public.submissions;
CREATE TRIGGER submissions_guard_trg
BEFORE INSERT OR UPDATE ON public.submissions
FOR EACH ROW EXECUTE FUNCTION public.submissions_guard();

-- 3) daily_missions: completed / reward_coins はサーバー側処理のみ
CREATE OR REPLACE FUNCTION public.daily_missions_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.completed := false;
    NEW.reward_coins := 0;
  ELSE
    NEW.completed := OLD.completed;
    NEW.reward_coins := OLD.reward_coins;
    NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS daily_missions_guard_trg ON public.daily_missions;
CREATE TRIGGER daily_missions_guard_trg
BEFORE INSERT OR UPDATE ON public.daily_missions
FOR EACH ROW EXECUTE FUNCTION public.daily_missions_guard();

-- 4) makron_pack_attempts: 報酬集計はサーバー側処理のみ
CREATE OR REPLACE FUNCTION public.makron_pack_attempts_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.xp_earned_total := 0;
    NEW.coins_earned_total := 0;
    NEW.rewards_granted_count := 0;
  ELSE
    NEW.xp_earned_total := OLD.xp_earned_total;
    NEW.coins_earned_total := OLD.coins_earned_total;
    NEW.rewards_granted_count := OLD.rewards_granted_count;
    NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS makron_pack_attempts_guard_trg ON public.makron_pack_attempts;
CREATE TRIGGER makron_pack_attempts_guard_trg
BEFORE INSERT OR UPDATE ON public.makron_pack_attempts
FOR EACH ROW EXECUTE FUNCTION public.makron_pack_attempts_guard();