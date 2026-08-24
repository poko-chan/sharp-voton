-- Timeline: add per-post visibility (public / followers / private) and align RLS
ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'followers', 'private'));

CREATE INDEX IF NOT EXISTS social_posts_visibility_idx ON public.social_posts (visibility);

-- Helper: can a given user view a given social post, honouring visibility + org scoping
CREATE OR REPLACE FUNCTION public.can_view_social_post(_post_id uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.social_posts p
    WHERE p.id = _post_id
      AND (
        p.user_id = _uid
        OR (p.organization_id IS NOT NULL AND public.is_org_member(p.organization_id, _uid))
        OR (p.organization_id IS NULL AND p.visibility = 'public')
        OR (
          p.organization_id IS NULL AND p.visibility = 'followers'
          AND EXISTS (
            SELECT 1 FROM public.follows f
            WHERE f.follower_id = _uid AND f.following_id = p.user_id AND f.status = 'accepted'
          )
        )
      )
  )
$$;

DROP POLICY IF EXISTS "read posts" ON public.social_posts;
CREATE POLICY "read posts" ON public.social_posts FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (organization_id IS NOT NULL AND public.is_org_member(organization_id, auth.uid()))
    OR (organization_id IS NULL AND visibility = 'public')
    OR (
      organization_id IS NULL AND visibility = 'followers'
      AND EXISTS (
        SELECT 1 FROM public.follows f
        WHERE f.follower_id = auth.uid() AND f.following_id = social_posts.user_id AND f.status = 'accepted'
      )
    )
  );

DROP POLICY IF EXISTS "read comments" ON public.social_comments;
CREATE POLICY "read comments" ON public.social_comments FOR SELECT TO authenticated
  USING (public.can_view_social_post(post_id, auth.uid()));

DROP POLICY IF EXISTS "read likes" ON public.social_likes;
CREATE POLICY "read likes" ON public.social_likes FOR SELECT TO authenticated
  USING (public.can_view_social_post(post_id, auth.uid()));

-- Prevent liking/commenting on posts you cannot view
DROP POLICY IF EXISTS "own likes" ON public.social_likes;
CREATE POLICY "own likes" ON public.social_likes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_view_social_post(post_id, auth.uid()));

DROP POLICY IF EXISTS "own comments" ON public.social_comments;
CREATE POLICY "own comments" ON public.social_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_view_social_post(post_id, auth.uid()));
