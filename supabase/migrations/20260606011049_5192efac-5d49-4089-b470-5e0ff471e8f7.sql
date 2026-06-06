
-- follows
CREATE TABLE public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY fl_read ON public.follows FOR SELECT TO authenticated USING (true);
CREATE POLICY fl_insert ON public.follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY fl_delete ON public.follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- group rooms
CREATE TABLE public.group_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_rooms TO authenticated;
GRANT ALL ON public.group_rooms TO service_role;
ALTER TABLE public.group_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY gr_read ON public.group_rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY gr_write ON public.group_rooms FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TABLE public.group_room_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.group_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'idle',
  started_at timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_room_members TO authenticated;
GRANT ALL ON public.group_room_members TO service_role;
ALTER TABLE public.group_room_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY grm_read ON public.group_room_members FOR SELECT TO authenticated USING (true);
CREATE POLICY grm_self ON public.group_room_members FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- flashcards (SRS)
CREATE TABLE public.flashcards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  deck text NOT NULL DEFAULT 'default',
  front text NOT NULL,
  back text NOT NULL,
  ease real NOT NULL DEFAULT 2.5,
  interval_days int NOT NULL DEFAULT 0,
  next_review_at timestamptz NOT NULL DEFAULT now(),
  reviews int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flashcards TO authenticated;
GRANT ALL ON public.flashcards TO service_role;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
CREATE POLICY fc_owner ON public.flashcards FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- OCR notes
CREATE TABLE public.ocr_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ocr_notes TO authenticated;
GRANT ALL ON public.ocr_notes TO service_role;
ALTER TABLE public.ocr_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY ocr_owner ON public.ocr_notes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- focus logs
CREATE TABLE public.focus_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  minutes int NOT NULL DEFAULT 0,
  blur_count int NOT NULL DEFAULT 0,
  score int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.focus_logs TO authenticated;
GRANT ALL ON public.focus_logs TO service_role;
ALTER TABLE public.focus_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY foc_owner ON public.focus_logs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- streak freezes
CREATE TABLE public.streak_freezes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL,
  used_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.streak_freezes TO authenticated;
GRANT ALL ON public.streak_freezes TO service_role;
ALTER TABLE public.streak_freezes ENABLE ROW LEVEL SECURITY;
CREATE POLICY sf_owner ON public.streak_freezes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- polls
CREATE TABLE public.polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  question text NOT NULL,
  options jsonb NOT NULL,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.polls TO authenticated;
GRANT ALL ON public.polls TO service_role;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_read ON public.polls FOR SELECT TO authenticated USING (true);
CREATE POLICY p_write ON public.polls FOR ALL TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  option_index int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.poll_votes TO authenticated;
GRANT ALL ON public.poll_votes TO service_role;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY pv_read ON public.poll_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY pv_self ON public.poll_votes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- user prefs (widgets, accessibility)
CREATE TABLE public.user_prefs (
  user_id uuid PRIMARY KEY,
  widgets jsonb NOT NULL DEFAULT '[]'::jsonb,
  font_scale real NOT NULL DEFAULT 1.0,
  high_contrast boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_prefs TO authenticated;
GRANT ALL ON public.user_prefs TO service_role;
ALTER TABLE public.user_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY up_owner ON public.user_prefs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_room_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.polls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;
