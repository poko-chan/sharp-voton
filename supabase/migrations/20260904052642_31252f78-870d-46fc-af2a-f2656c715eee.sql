
CREATE TABLE public.notebook_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notebook_subjects TO authenticated;
GRANT ALL ON public.notebook_subjects TO service_role;
ALTER TABLE public.notebook_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY nbs_all ON public.notebook_subjects FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.notebooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  subject_id uuid REFERENCES public.notebook_subjects(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '新しいノート',
  cover_color text NOT NULL DEFAULT '#2563eb',
  paper_type text NOT NULL DEFAULT 'ruled',
  paper_color text NOT NULL DEFAULT '#ffffff',
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.notebook_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id uuid NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  page_index int NOT NULL DEFAULT 0,
  strokes jsonb NOT NULL DEFAULT '[]'::jsonb,
  texts jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE (notebook_id, page_index)
);

CREATE TABLE public.notebook_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id uuid NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  user_id uuid NOT NULL,
  can_edit boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notebook_id, user_id)
);

CREATE OR REPLACE FUNCTION public.notebook_can_view(_nb uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.notebooks n WHERE n.id = _nb AND n.owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.notebook_shares s WHERE s.notebook_id = _nb AND s.user_id = auth.uid() AND s.status = 'accepted');
$$;
CREATE OR REPLACE FUNCTION public.notebook_can_edit(_nb uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.notebooks n WHERE n.id = _nb AND n.owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.notebook_shares s WHERE s.notebook_id = _nb AND s.user_id = auth.uid() AND s.status = 'accepted' AND s.can_edit);
$$;
REVOKE ALL ON FUNCTION public.notebook_can_view(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.notebook_can_edit(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.notebook_can_view(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notebook_can_edit(uuid) TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notebooks TO authenticated;
GRANT ALL ON public.notebooks TO service_role;
ALTER TABLE public.notebooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY nb_select ON public.notebooks FOR SELECT TO authenticated USING (public.notebook_can_view(id));
CREATE POLICY nb_insert ON public.notebooks FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY nb_update ON public.notebooks FOR UPDATE TO authenticated USING (public.notebook_can_edit(id)) WITH CHECK (public.notebook_can_edit(id));
CREATE POLICY nb_delete ON public.notebooks FOR DELETE TO authenticated USING (auth.uid() = owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notebook_pages TO authenticated;
GRANT ALL ON public.notebook_pages TO service_role;
ALTER TABLE public.notebook_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY nbp_select ON public.notebook_pages FOR SELECT TO authenticated USING (public.notebook_can_view(notebook_id));
CREATE POLICY nbp_insert ON public.notebook_pages FOR INSERT TO authenticated WITH CHECK (public.notebook_can_edit(notebook_id));
CREATE POLICY nbp_update ON public.notebook_pages FOR UPDATE TO authenticated USING (public.notebook_can_edit(notebook_id)) WITH CHECK (public.notebook_can_edit(notebook_id));
CREATE POLICY nbp_delete ON public.notebook_pages FOR DELETE TO authenticated USING (public.notebook_can_edit(notebook_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notebook_shares TO authenticated;
GRANT ALL ON public.notebook_shares TO service_role;
ALTER TABLE public.notebook_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY nbsh_select ON public.notebook_shares FOR SELECT TO authenticated USING (auth.uid() = owner_id OR auth.uid() = user_id);
CREATE POLICY nbsh_insert ON public.notebook_shares FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id AND EXISTS (SELECT 1 FROM public.notebooks n WHERE n.id = notebook_id AND n.owner_id = auth.uid()));
CREATE POLICY nbsh_update_owner ON public.notebook_shares FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY nbsh_update_recipient ON public.notebook_shares FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY nbsh_delete ON public.notebook_shares FOR DELETE TO authenticated USING (auth.uid() = owner_id OR auth.uid() = user_id);

CREATE INDEX idx_notebook_pages_nb ON public.notebook_pages(notebook_id, page_index);
CREATE INDEX idx_notebook_shares_user ON public.notebook_shares(user_id, status);
