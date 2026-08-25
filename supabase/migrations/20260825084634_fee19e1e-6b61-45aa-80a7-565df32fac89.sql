
-- 1) 全行閲覧ポリシーを廃止し、本人・管理者・保護者のみに限定
DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;

CREATE POLICY profiles_select_own_or_privileged ON public.profiles
FOR SELECT TO authenticated
USING (
  auth.uid() = id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_parent_of(auth.uid(), id)
);

-- 2) 公開情報のみのビュー
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = false, security_barrier = true) AS
SELECT id, username, display_name, avatar_url
FROM public.profiles;

REVOKE ALL ON public.public_profiles FROM anon, authenticated;
GRANT SELECT ON public.public_profiles TO authenticated;
