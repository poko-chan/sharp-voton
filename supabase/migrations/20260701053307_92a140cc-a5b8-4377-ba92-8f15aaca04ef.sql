
CREATE TABLE IF NOT EXISTS public.class_qa_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL, body text, best_answer_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_qa_questions TO authenticated;
GRANT ALL ON public.class_qa_questions TO service_role;
ALTER TABLE public.class_qa_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa_q_read" ON public.class_qa_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "qa_q_write" ON public.class_qa_questions FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

CREATE TABLE IF NOT EXISTS public.class_qa_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.class_qa_questions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_qa_answers TO authenticated;
GRANT ALL ON public.class_qa_answers TO service_role;
ALTER TABLE public.class_qa_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa_a_read" ON public.class_qa_answers FOR SELECT TO authenticated USING (true);
CREATE POLICY "qa_a_write" ON public.class_qa_answers FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

CREATE TABLE IF NOT EXISTS public.coedit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '無題', content text NOT NULL DEFAULT '',
  collaborators uuid[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coedit_notes TO authenticated;
GRANT ALL ON public.coedit_notes TO service_role;
ALTER TABLE public.coedit_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coedit_rw" ON public.coedit_notes FOR ALL TO authenticated
  USING (auth.uid()=owner_id OR auth.uid()=ANY(collaborators))
  WITH CHECK (auth.uid()=owner_id OR auth.uid()=ANY(collaborators));
ALTER PUBLICATION supabase_realtime ADD TABLE public.coedit_notes;

CREATE TABLE IF NOT EXISTS public.group_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  starts_on date NOT NULL DEFAULT current_date,
  ends_on date NOT NULL DEFAULT (current_date + 7),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_challenges TO authenticated;
GRANT ALL ON public.group_challenges TO service_role;
ALTER TABLE public.group_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gc_r" ON public.group_challenges FOR SELECT TO authenticated USING (true);
CREATE POLICY "gc_w" ON public.group_challenges FOR ALL TO authenticated USING (auth.uid()=owner_id) WITH CHECK (auth.uid()=owner_id);

CREATE TABLE IF NOT EXISTS public.group_challenge_members (
  challenge_id uuid NOT NULL REFERENCES public.group_challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team text NOT NULL DEFAULT 'A',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_challenge_members TO authenticated;
GRANT ALL ON public.group_challenge_members TO service_role;
ALTER TABLE public.group_challenge_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gcm_r" ON public.group_challenge_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "gcm_w" ON public.group_challenge_members FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

CREATE TABLE IF NOT EXISTS public.mentor_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question text NOT NULL, answer text,
  reward_coins int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.mentor_sessions TO authenticated;
GRANT ALL ON public.mentor_sessions TO service_role;
ALTER TABLE public.mentor_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ms_r" ON public.mentor_sessions FOR SELECT TO authenticated USING (auth.uid() IN (mentor_id, student_id));
CREATE POLICY "ms_i" ON public.mentor_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid()=student_id);
CREATE POLICY "ms_u" ON public.mentor_sessions FOR UPDATE TO authenticated USING (auth.uid()=mentor_id);

CREATE TABLE IF NOT EXISTS public.daily_mystery_box (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT current_date,
  reward_coins int NOT NULL,
  PRIMARY KEY (user_id, date)
);
GRANT SELECT, INSERT ON public.daily_mystery_box TO authenticated;
GRANT ALL ON public.daily_mystery_box TO service_role;
ALTER TABLE public.daily_mystery_box ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dmb_self" ON public.daily_mystery_box FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

CREATE TABLE IF NOT EXISTS public.daily_slot_plays (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT current_date,
  reward_coins int NOT NULL,
  PRIMARY KEY (user_id, date)
);
GRANT SELECT, INSERT ON public.daily_slot_plays TO authenticated;
GRANT ALL ON public.daily_slot_plays TO service_role;
ALTER TABLE public.daily_slot_plays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dsp_self" ON public.daily_slot_plays FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

CREATE TABLE IF NOT EXISTS public.style_diagnosis (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  focus int NOT NULL DEFAULT 0, memory int NOT NULL DEFAULT 0,
  logic int NOT NULL DEFAULT 0, creativity int NOT NULL DEFAULT 0,
  stamina int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.style_diagnosis TO authenticated;
GRANT ALL ON public.style_diagnosis TO service_role;
ALTER TABLE public.style_diagnosis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sd_self" ON public.style_diagnosis FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

CREATE TABLE IF NOT EXISTS public.voice_diaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transcript text NOT NULL, summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.voice_diaries TO authenticated;
GRANT ALL ON public.voice_diaries TO service_role;
ALTER TABLE public.voice_diaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vd_self" ON public.voice_diaries FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

CREATE TABLE IF NOT EXISTS public.rival_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  a_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  b_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  a_minutes int NOT NULL DEFAULT 0,
  b_minutes int NOT NULL DEFAULT 0,
  winner uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (a_id, b_id, week_start)
);
GRANT SELECT, INSERT, UPDATE ON public.rival_matches TO authenticated;
GRANT ALL ON public.rival_matches TO service_role;
ALTER TABLE public.rival_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rm_rw" ON public.rival_matches FOR ALL TO authenticated USING (auth.uid() IN (a_id, b_id)) WITH CHECK (auth.uid() IN (a_id, b_id));

CREATE TABLE IF NOT EXISTS public.photo_study_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url text NOT NULL, caption text,
  likes int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.photo_study_logs TO authenticated;
GRANT ALL ON public.photo_study_logs TO service_role;
ALTER TABLE public.photo_study_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "psl_r" ON public.photo_study_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "psl_w" ON public.photo_study_logs FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

INSERT INTO public.coin_shop_items (code, name, description, price, category, is_active)
VALUES
  ('slot_boost_v1', 'ラッキースロット強化', 'スロットの当選率が3日間+20%', 200, 'boost', true),
  ('mbox_gold_v1', 'ミステリーボックス金色', '今日の宝箱を最大報酬に', 150, 'boost', true),
  ('mentor_ticket_v1', 'メンター指名券', '任意の上位者に質問を送れる', 100, 'ticket', true),
  ('coedit_seat_v1', '共同ノート枠+1', '同時編集に招待できる人数を+1', 300, 'upgrade', true),
  ('streak_ins_v1', '週次ストリーク保険', '週1回連続を守る自動保険', 250, 'insurance', true)
ON CONFLICT (code) DO NOTHING;
