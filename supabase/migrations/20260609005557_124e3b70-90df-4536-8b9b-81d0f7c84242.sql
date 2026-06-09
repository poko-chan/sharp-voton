
-- 1. POLLS: scope to a class
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE;
DROP POLICY IF EXISTS "p_read" ON public.polls;
DROP POLICY IF EXISTS "p_write" ON public.polls;
CREATE POLICY "polls_read_class" ON public.polls FOR SELECT TO authenticated
  USING (class_id IS NULL OR public.is_class_member(class_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "polls_write_class" ON public.polls FOR ALL TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (
    auth.uid() = created_by AND (class_id IS NULL OR public.is_class_member(class_id, auth.uid()))
  );

-- 2. GROUP ROOMS: add status + topic, allow owner update/delete (gr_write FOR ALL already covers it)
ALTER TABLE public.group_rooms ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'waiting';
ALTER TABLE public.group_rooms ADD COLUMN IF NOT EXISTS topic text;

-- 3. FOLLOWS: mutual approval
ALTER TABLE public.follows ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'accepted';
-- Helper: are two users mutual friends?
CREATE OR REPLACE FUNCTION public.are_mutual_friends(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.follows f1
    JOIN public.follows f2 ON f2.follower_id = f1.following_id AND f2.following_id = f1.follower_id
    WHERE f1.follower_id = _a AND f1.following_id = _b
      AND f1.status = 'accepted' AND f2.status = 'accepted'
  )
$$;

-- 4. CHAT: require mutual friends (admins bypass)
DROP POLICY IF EXISTS "chat_insert_own" ON public.chat_messages;
CREATE POLICY "chat_insert_mutual" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.are_mutual_friends(sender_id, recipient_id))
  );

-- 5. ADMIN NAV CONFIG
CREATE TABLE IF NOT EXISTS public.admin_nav_config (
  key text PRIMARY KEY,
  label text,
  icon_url text,
  visible boolean NOT NULL DEFAULT true,
  in_quickbar boolean NOT NULL DEFAULT false,
  order_idx integer NOT NULL DEFAULT 100,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_nav_config TO authenticated;
GRANT ALL ON public.admin_nav_config TO service_role;
ALTER TABLE public.admin_nav_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nav_read_all" ON public.admin_nav_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "nav_admin_write" ON public.admin_nav_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
