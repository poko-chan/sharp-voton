
-- 1) Add status / authorship columns
ALTER TABLE public.makron_questions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid;

-- Backfill existing rows as approved (公式)
UPDATE public.makron_questions SET status = 'approved' WHERE status = 'pending';

ALTER TABLE public.makron_questions
  ADD CONSTRAINT makron_questions_status_chk CHECK (status IN ('pending','approved','rejected'));

CREATE INDEX IF NOT EXISTS makron_questions_status_idx ON public.makron_questions(status);
CREATE INDEX IF NOT EXISTS makron_questions_created_by_idx ON public.makron_questions(created_by);

-- 2) Trigger: enforce status based on role at insert
CREATE OR REPLACE FUNCTION public.makron_question_set_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  IF TG_OP = 'INSERT' THEN
    IF public.has_role(auth.uid(), 'admin') THEN
      NEW.status := 'approved';
      NEW.reviewed_at := now();
      NEW.reviewed_by := auth.uid();
    ELSE
      NEW.status := 'pending';
      NEW.submitted_at := now();
      NEW.reviewed_at := NULL;
      NEW.reviewed_by := NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS makron_question_set_status_trg ON public.makron_questions;
CREATE TRIGGER makron_question_set_status_trg
  BEFORE INSERT ON public.makron_questions
  FOR EACH ROW EXECUTE FUNCTION public.makron_question_set_status();

-- 3) Tighten makron_units policies (admin only)
DROP POLICY IF EXISTS "creators write units" ON public.makron_units;
DROP POLICY IF EXISTS "creators update units" ON public.makron_units;
DROP POLICY IF EXISTS "creators delete units" ON public.makron_units;

-- 4) Question policies: creators can only edit/delete OWN pending questions
DROP POLICY IF EXISTS "creators update questions" ON public.makron_questions;
DROP POLICY IF EXISTS "creators delete questions" ON public.makron_questions;

CREATE POLICY "creators edit own pending q" ON public.makron_questions
  FOR UPDATE
  USING (created_by = auth.uid() AND status = 'pending')
  WITH CHECK (created_by = auth.uid() AND status = 'pending');

CREATE POLICY "creators delete own pending q" ON public.makron_questions
  FOR DELETE
  USING (created_by = auth.uid() AND status = 'pending');

-- 5) Approve / reject RPC
CREATE OR REPLACE FUNCTION public.admin_review_question(_question_id uuid, _approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.makron_questions
    SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
        reviewed_at = now(),
        reviewed_by = auth.uid()
    WHERE id = _question_id;

  INSERT INTO public.admin_audit_log(admin_id, action, target_user, details)
  SELECT auth.uid(), CASE WHEN _approve THEN 'approve_question' ELSE 'reject_question' END,
         q.created_by, jsonb_build_object('question_id', _question_id)
  FROM public.makron_questions q WHERE q.id = _question_id;

  -- Notify creator
  INSERT INTO public.notifications(user_id, type, title, body, meta)
  SELECT q.created_by,
         CASE WHEN _approve THEN 'question_approved' ELSE 'question_rejected' END,
         CASE WHEN _approve THEN '問題が公式承認されました' ELSE '問題が却下されました' END,
         left(q.prompt, 100),
         jsonb_build_object('question_id', _question_id)
  FROM public.makron_questions q
  WHERE q.id = _question_id AND q.created_by IS NOT NULL AND q.created_by <> auth.uid();
END $$;

-- 6) Shop: +5 new items (project rule: every turn add 5)
INSERT INTO public.coin_shop_items (code, name, description, category, price, payload, consumable, is_active)
VALUES
  ('frame_sakura', 'アバターフレーム「桜」', '春の桜が舞うフレーム', 'avatar_frame', 350, '{"frame":"sakura"}'::jsonb, false, true),
  ('bg_starfield', '背景「星空」', 'プロフィール背景に星空', 'background', 400, '{"bg":"starfield"}'::jsonb, false, true),
  ('title_creator', '称号「クリエイター」', '承認された問題の作成者向け', 'title', 600, '{"title":"クリエイター"}'::jsonb, false, true),
  ('revive_ticket', '復活券', 'ストリークを1日復活', 'consumable', 300, '{"type":"revive"}'::jsonb, true, true),
  ('frame_neon', 'アバターフレーム「ネオン」', '光るネオンフレーム', 'avatar_frame', 450, '{"frame":"neon"}'::jsonb, false, true)
ON CONFLICT (code) DO NOTHING;
