
-- 1. feedback table
CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text,
  category text NOT NULL DEFAULT 'other',
  body text NOT NULL,
  route text,
  user_agent text,
  status text NOT NULL DEFAULT 'open',
  admin_reply text,
  replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY fb_insert_any ON public.feedback FOR INSERT
  WITH CHECK (
    (auth.uid() IS NULL AND user_id IS NULL)
    OR (auth.uid() = user_id)
  );
CREATE POLICY fb_select_own_or_admin ON public.feedback FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY fb_update_admin ON public.feedback FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY fb_delete_admin ON public.feedback FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. announcements.show_on_login
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS show_on_login boolean NOT NULL DEFAULT false;

-- Public can read announcements that are flagged for login screen
CREATE POLICY announcements_login_public ON public.announcements FOR SELECT
  TO anon, authenticated
  USING (show_on_login = true AND publish_at <= now());

-- 3. profiles deletion fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deletion_code text,
  ADD COLUMN IF NOT EXISTS deletion_code_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_scheduled_at timestamptz;

-- 4. MCJP_ role protection trigger
CREATE OR REPLACE FUNCTION public.protect_mcjp_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uname text;
  target_id uuid;
BEGIN
  target_id := COALESCE(NEW.user_id, OLD.user_id);
  SELECT username INTO uname FROM public.profiles WHERE id = target_id;
  IF uname IS NOT NULL AND lower(uname) LIKE 'mcjp_%' THEN
    RAISE EXCEPTION 'MCJP_ ユーザーの権限は変更できません';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS protect_mcjp_roles_trg ON public.user_roles;
CREATE TRIGGER protect_mcjp_roles_trg
  BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.protect_mcjp_roles();
