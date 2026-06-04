-- =====================================================================
-- 1) Per-service restrictions (replaces global service-stop)
-- =====================================================================
CREATE TABLE public.service_restrictions (
  service_key TEXT PRIMARY KEY,
  restricted BOOLEAN NOT NULL DEFAULT false,
  message TEXT,
  restricted_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.service_restrictions TO anon, authenticated;
GRANT ALL ON public.service_restrictions TO service_role;
ALTER TABLE public.service_restrictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sr_read_all ON public.service_restrictions FOR SELECT USING (true);
CREATE POLICY sr_admin_write ON public.service_restrictions FOR ALL
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

CREATE TABLE public.user_service_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  service_key TEXT NOT NULL,
  restricted BOOLEAN NOT NULL DEFAULT true,
  message TEXT,
  restricted_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, service_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_service_restrictions TO authenticated;
GRANT ALL ON public.user_service_restrictions TO service_role;
ALTER TABLE public.user_service_restrictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY usr_select_self_or_admin ON public.user_service_restrictions FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY usr_admin_write ON public.user_service_restrictions FOR ALL
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- =====================================================================
-- 2) Time management (Today)
-- =====================================================================
CREATE TABLE public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  category TEXT NOT NULL,        -- sleep, school, study, meal, hobby, lesson, idle, break, other
  subject_id UUID,               -- optional (school内の教科, study教科)
  label TEXT,                    -- 例: "数学", "ピアノ", "夕食"
  note TEXT,
  color TEXT,                    -- 個別の色上書き
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX te_user_date_idx ON public.time_entries (user_id, date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_entries TO authenticated;
GRANT ALL ON public.time_entries TO service_role;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY te_owner_all ON public.time_entries FOR ALL
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'::app_role));

CREATE TABLE public.time_category_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  category TEXT NOT NULL,
  color TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, category)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_category_settings TO authenticated;
GRANT ALL ON public.time_category_settings TO service_role;
ALTER TABLE public.time_category_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY tcs_owner_all ON public.time_category_settings FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#a855f7',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lessons TO authenticated;
GRANT ALL ON public.lessons TO service_role;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY lessons_owner_all ON public.lessons FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.school_timetable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  weekday INTEGER NOT NULL,  -- 0=Sun ... 6=Sat
  period INTEGER NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  subject_id UUID,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_timetable TO authenticated;
GRANT ALL ON public.school_timetable TO service_role;
ALTER TABLE public.school_timetable ENABLE ROW LEVEL SECURITY;
CREATE POLICY st_owner_all ON public.school_timetable FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- updated_at triggers
CREATE TRIGGER te_set_updated_at BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tcs_set_updated_at BEFORE UPDATE ON public.time_category_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER sr_set_updated_at BEFORE UPDATE ON public.service_restrictions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER usr_set_updated_at BEFORE UPDATE ON public.user_service_restrictions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.service_restrictions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_service_restrictions;
