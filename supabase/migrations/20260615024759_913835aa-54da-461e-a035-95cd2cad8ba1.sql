
-- =========================================================
-- Feature 1: Streak Insurance
-- =========================================================
CREATE TABLE IF NOT EXISTS public.streak_insurance_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  used_for_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.streak_insurance_uses TO authenticated;
GRANT ALL ON public.streak_insurance_uses TO service_role;
ALTER TABLE public.streak_insurance_uses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own streak insurance" ON public.streak_insurance_uses FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- =========================================================
-- Feature 3: Admin difficulty adjustments
-- =========================================================
CREATE TABLE IF NOT EXISTS public.difficulty_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL,
  admin_id uuid NOT NULL,
  difficulty_score int NOT NULL CHECK (difficulty_score BETWEEN 1 AND 5),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.difficulty_adjustments TO authenticated;
GRANT ALL ON public.difficulty_adjustments TO service_role;
ALTER TABLE public.difficulty_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manages difficulty" ON public.difficulty_adjustments FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "all read difficulty" ON public.difficulty_adjustments FOR SELECT USING (auth.uid() IS NOT NULL);

-- =========================================================
-- Feature 4: Unit roadmap
-- =========================================================
CREATE TABLE IF NOT EXISTS public.unit_roadmap (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL,
  parent_unit_id uuid,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.unit_roadmap TO authenticated;
GRANT ALL ON public.unit_roadmap TO service_role;
ALTER TABLE public.unit_roadmap ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read roadmap" ON public.unit_roadmap FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin writes roadmap" ON public.unit_roadmap FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================================
-- Feature 5: Daily Three curated questions
-- =========================================================
CREATE TABLE IF NOT EXISTS public.daily_three (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  for_date date NOT NULL,
  question_id uuid NOT NULL,
  slot int NOT NULL CHECK (slot BETWEEN 1 AND 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(for_date, slot)
);
GRANT SELECT ON public.daily_three TO authenticated;
GRANT ALL ON public.daily_three TO service_role;
ALTER TABLE public.daily_three ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read daily three" ON public.daily_three FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin writes daily three" ON public.daily_three FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================================
-- Feature 6: Study Room sessions
-- =========================================================
CREATE TABLE IF NOT EXISTS public.study_room_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_minutes int
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_room_sessions TO authenticated;
GRANT ALL ON public.study_room_sessions TO service_role;
ALTER TABLE public.study_room_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own room sessions" ON public.study_room_sessions FOR ALL
  USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE POLICY "room peers read" ON public.study_room_sessions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.group_room_members m WHERE m.room_id=study_room_sessions.room_id AND m.user_id=auth.uid()));

-- =========================================================
-- Feature 7: SRS reviews
-- =========================================================
CREATE TABLE IF NOT EXISTS public.srs_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  flashcard_id uuid NOT NULL,
  ease numeric NOT NULL DEFAULT 2.5,
  interval_days int NOT NULL DEFAULT 1,
  next_review_at timestamptz NOT NULL DEFAULT now(),
  last_rating int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, flashcard_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.srs_reviews TO authenticated;
GRANT ALL ON public.srs_reviews TO service_role;
ALTER TABLE public.srs_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own srs" ON public.srs_reviews FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- =========================================================
-- Feature 8: Notebook photos (non-OCR)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.notebook_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text,
  image_url text NOT NULL,
  subject_id uuid,
  taken_on date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notebook_photos TO authenticated;
GRANT ALL ON public.notebook_photos TO service_role;
ALTER TABLE public.notebook_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own photos" ON public.notebook_photos FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- =========================================================
-- Feature 9: Weekly Parent Reports
-- =========================================================
CREATE TABLE IF NOT EXISTS public.weekly_parent_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL,
  week_start date NOT NULL,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(child_id, week_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_parent_reports TO authenticated;
GRANT ALL ON public.weekly_parent_reports TO service_role;
ALTER TABLE public.weekly_parent_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "child reads own report" ON public.weekly_parent_reports FOR SELECT USING (auth.uid()=child_id);
CREATE POLICY "parent reads child report" ON public.weekly_parent_reports FOR SELECT
  USING (public.is_parent_of(auth.uid(), child_id));

-- =========================================================
-- Feature 10: Class mini-tests
-- =========================================================
CREATE TABLE IF NOT EXISTS public.class_mini_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL,
  title text NOT NULL,
  unit_id uuid,
  question_ids uuid[] NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_mini_tests TO authenticated;
GRANT ALL ON public.class_mini_tests TO service_role;
ALTER TABLE public.class_mini_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "class members read tests" ON public.class_mini_tests FOR SELECT
  USING (public.is_class_member(class_id, auth.uid()));
CREATE POLICY "teachers manage tests" ON public.class_mini_tests FOR ALL
  USING (public.is_class_teacher(class_id, auth.uid())) WITH CHECK (public.is_class_teacher(class_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.class_mini_test_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL,
  user_id uuid NOT NULL,
  score int,
  total int,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_mini_test_attempts TO authenticated;
GRANT ALL ON public.class_mini_test_attempts TO service_role;
ALTER TABLE public.class_mini_test_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own attempts" ON public.class_mini_test_attempts FOR ALL
  USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- =========================================================
-- Feature 11: Test countdowns
-- =========================================================
CREATE TABLE IF NOT EXISTS public.test_countdowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  test_date date NOT NULL,
  subject text,
  plan_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_countdowns TO authenticated;
GRANT ALL ON public.test_countdowns TO service_role;
ALTER TABLE public.test_countdowns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own countdowns" ON public.test_countdowns FOR ALL
  USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- =========================================================
-- Feature 12: Badges encyclopedia
-- =========================================================
CREATE TABLE IF NOT EXISTS public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  icon text,
  rarity text DEFAULT 'common',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.badges TO authenticated;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read badges" ON public.badges FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin writes badges" ON public.badges FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.user_badge_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_code text NOT NULL,
  progress int NOT NULL DEFAULT 0,
  unlocked_at timestamptz,
  UNIQUE(user_id, badge_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_badge_progress TO authenticated;
GRANT ALL ON public.user_badge_progress TO service_role;
ALTER TABLE public.user_badge_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own badge progress" ON public.user_badge_progress FOR ALL
  USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- =========================================================
-- Feature 13: Weekly coin leaderboard (view)
-- =========================================================
CREATE OR REPLACE VIEW public.weekly_coin_leaderboard AS
SELECT
  t.user_id,
  p.display_name,
  p.avatar_url,
  COALESCE(SUM(t.amount) FILTER (WHERE t.amount > 0), 0)::int AS coins_earned,
  date_trunc('week', now())::date AS week_start
FROM public.coin_transactions t
JOIN public.profiles p ON p.id = t.user_id
WHERE t.created_at >= date_trunc('week', now())
GROUP BY t.user_id, p.display_name, p.avatar_url
ORDER BY coins_earned DESC;
GRANT SELECT ON public.weekly_coin_leaderboard TO authenticated;

-- =========================================================
-- Feature 14: Timetable templates
-- =========================================================
CREATE TABLE IF NOT EXISTS public.school_timetable_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_public boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.school_timetable_templates TO authenticated;
GRANT ALL ON public.school_timetable_templates TO service_role;
ALTER TABLE public.school_timetable_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read public templates" ON public.school_timetable_templates FOR SELECT
  USING (is_public OR auth.uid() = created_by);
CREATE POLICY "create own template" ON public.school_timetable_templates FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- =========================================================
-- Feature 16: Anonymous reflections
-- =========================================================
CREATE TABLE IF NOT EXISTS public.anonymous_reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  content text NOT NULL,
  mood text,
  likes_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.anonymous_reflections TO authenticated;
GRANT ALL ON public.anonymous_reflections TO service_role;
ALTER TABLE public.anonymous_reflections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all read anon" ON public.anonymous_reflections FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "own insert anon" ON public.anonymous_reflections FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "own delete anon" ON public.anonymous_reflections FOR DELETE USING (auth.uid() = author_id);

-- =========================================================
-- Feature 17: Plan template marketplace
-- =========================================================
CREATE TABLE IF NOT EXISTS public.plan_template_marketplace (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  downloads int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.plan_template_marketplace TO authenticated;
GRANT ALL ON public.plan_template_marketplace TO service_role;
ALTER TABLE public.plan_template_marketplace ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read all plan templates" ON public.plan_template_marketplace FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "own write plan template" ON public.plan_template_marketplace FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "own update plan template" ON public.plan_template_marketplace FOR UPDATE USING (auth.uid() = author_id);

-- =========================================================
-- Feature 18: Notification categories pref
-- =========================================================
CREATE TABLE IF NOT EXISTS public.notification_categories (
  user_id uuid PRIMARY KEY,
  prefs jsonb NOT NULL DEFAULT '{"social":true,"system":true,"missions":true,"class":true,"coins":true}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_categories TO authenticated;
GRANT ALL ON public.notification_categories TO service_role;
ALTER TABLE public.notification_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notif cat" ON public.notification_categories FOR ALL
  USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- =========================================================
-- Feature 19: Rivals
-- =========================================================
CREATE TABLE IF NOT EXISTS public.rivals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  rival_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, rival_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rivals TO authenticated;
GRANT ALL ON public.rivals TO service_role;
ALTER TABLE public.rivals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rivals" ON public.rivals FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- =========================================================
-- Feature 21: Class events
-- =========================================================
CREATE TABLE IF NOT EXISTS public.class_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  event_date date NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_events TO authenticated;
GRANT ALL ON public.class_events TO service_role;
ALTER TABLE public.class_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read events" ON public.class_events FOR SELECT
  USING (public.is_class_member(class_id, auth.uid()));
CREATE POLICY "teachers manage events" ON public.class_events FOR ALL
  USING (public.is_class_teacher(class_id, auth.uid())) WITH CHECK (public.is_class_teacher(class_id, auth.uid()));

-- =========================================================
-- Feature 22: Parent invite codes
-- =========================================================
CREATE TABLE IF NOT EXISTS public.parent_invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL,
  code text UNIQUE NOT NULL DEFAULT upper(substr(md5(random()::text),1,8)),
  used_by uuid,
  used_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '14 days',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parent_invite_codes TO authenticated;
GRANT ALL ON public.parent_invite_codes TO service_role;
ALTER TABLE public.parent_invite_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "child manages codes" ON public.parent_invite_codes FOR ALL
  USING (auth.uid()=child_id) WITH CHECK (auth.uid()=child_id);
CREATE POLICY "parent reads when using" ON public.parent_invite_codes FOR SELECT
  USING (auth.uid()=used_by);

-- =========================================================
-- Feature 23: Pinned missions
-- =========================================================
ALTER TABLE public.daily_missions ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;

-- =========================================================
-- Feature 24: Daily summary subscription
-- =========================================================
CREATE TABLE IF NOT EXISTS public.daily_summary_subscriptions (
  user_id uuid PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  channel text NOT NULL DEFAULT 'email',
  send_hour int NOT NULL DEFAULT 21 CHECK (send_hour BETWEEN 0 AND 23),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_summary_subscriptions TO authenticated;
GRANT ALL ON public.daily_summary_subscriptions TO service_role;
ALTER TABLE public.daily_summary_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subscription" ON public.daily_summary_subscriptions FOR ALL
  USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- =========================================================
-- Shop: +5 new items (project rule)
-- =========================================================
INSERT INTO public.coin_shop_items (code, name, description, category, price, payload, consumable, is_active)
VALUES
  ('streak_insurance', 'ストリーク保険券', '1日サボってもストリークを守る', 'consumable', 250, '{"type":"streak_insurance"}'::jsonb, true, true),
  ('lofi_track_rain', 'Lo-Fi: 雨音トラック', '集中用BGM（雨音）', 'bgm', 180, '{"track":"rain"}'::jsonb, false, true),
  ('lofi_track_cafe', 'Lo-Fi: カフェトラック', '集中用BGM（カフェ）', 'bgm', 180, '{"track":"cafe"}'::jsonb, false, true),
  ('lofi_track_forest', 'Lo-Fi: 森トラック', '集中用BGM（森）', 'bgm', 180, '{"track":"forest"}'::jsonb, false, true),
  ('title_legend', '称号「伝説の学習者」', 'プロフィールに表示される伝説称号', 'title', 1200, '{"title":"伝説の学習者"}'::jsonb, false, true)
ON CONFLICT (code) DO NOTHING;

-- Seed a few default badges
INSERT INTO public.badges (code, name, description, icon, rarity) VALUES
  ('first_login', '初ログイン', '初めてログインした', '🌱', 'common'),
  ('streak_7', '7日連続', '7日連続で学習した', '🔥', 'rare'),
  ('streak_30', '30日連続', '30日連続で学習した', '🏆', 'epic'),
  ('makron_100', 'Makron100問', 'Makronを100問解いた', '💯', 'rare'),
  ('coin_1000', '1000コイン稼ぎ', '累計1000コイン獲得', '💰', 'rare')
ON CONFLICT (code) DO NOTHING;
