
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_kind text NOT NULL DEFAULT 'child' CHECK (account_kind IN ('child','parent','adult'));

CREATE TABLE IF NOT EXISTS public.parent_child_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL,
  child_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_id, child_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parent_child_links TO authenticated;
GRANT ALL ON public.parent_child_links TO service_role;
ALTER TABLE public.parent_child_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parent_links_select" ON public.parent_child_links FOR SELECT TO authenticated
  USING (auth.uid() = parent_id OR auth.uid() = child_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "parent_links_insert" ON public.parent_child_links FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = parent_id);
CREATE POLICY "parent_links_delete" ON public.parent_child_links FOR DELETE TO authenticated
  USING (auth.uid() = parent_id OR auth.uid() = child_id);

-- helper: is parent of given child
CREATE OR REPLACE FUNCTION public.is_parent_of(_parent uuid, _child uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.parent_child_links WHERE parent_id = _parent AND child_id = _child)
$$;

-- Parents can view their children's study/today/profile data (read only).
CREATE POLICY "study_logs_parent_view" ON public.study_logs FOR SELECT TO authenticated
  USING (public.is_parent_of(auth.uid(), user_id));
CREATE POLICY "study_plans_parent_view" ON public.study_plans FOR SELECT TO authenticated
  USING (public.is_parent_of(auth.uid(), user_id));
CREATE POLICY "today_entries_parent_view" ON public.today_entries FOR SELECT TO authenticated
  USING (public.is_parent_of(auth.uid(), user_id));
CREATE POLICY "subjects_parent_view" ON public.subjects FOR SELECT TO authenticated
  USING (public.is_parent_of(auth.uid(), user_id));
CREATE POLICY "goals_parent_view" ON public.goals FOR SELECT TO authenticated
  USING (public.is_parent_of(auth.uid(), user_id));
CREATE POLICY "habits_parent_view" ON public.habit_stamps FOR SELECT TO authenticated
  USING (public.is_parent_of(auth.uid(), user_id));

-- Parents can manage per-service restrictions for their children
CREATE POLICY "usr_restrictions_parent_all" ON public.user_service_restrictions FOR ALL TO authenticated
  USING (public.is_parent_of(auth.uid(), user_id))
  WITH CHECK (public.is_parent_of(auth.uid(), user_id));

-- Parents can update child profile (display_name, avatar_url)
CREATE POLICY "profiles_parent_update" ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_parent_of(auth.uid(), id))
  WITH CHECK (public.is_parent_of(auth.uid(), id));

-- Extend user_prefs
ALTER TABLE public.user_prefs ADD COLUMN IF NOT EXISTS right_dock jsonb DEFAULT '["ambient","feedback","voice"]'::jsonb;
ALTER TABLE public.user_prefs ADD COLUMN IF NOT EXISTS sidebar_hidden jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.user_prefs ADD COLUMN IF NOT EXISTS act_as_admin boolean NOT NULL DEFAULT false;
