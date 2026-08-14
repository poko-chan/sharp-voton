CREATE TABLE public.social_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  minutes int,
  subject text,
  organization_id uuid references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_posts TO authenticated;
GRANT ALL ON public.social_posts TO service_role;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read posts" ON public.social_posts FOR SELECT TO authenticated
  USING (organization_id IS NULL OR public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "own posts insert" ON public.social_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own posts update" ON public.social_posts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own posts delete" ON public.social_posts FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER social_posts_updated BEFORE UPDATE ON public.social_posts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.social_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.social_likes TO authenticated;
GRANT ALL ON public.social_likes TO service_role;
ALTER TABLE public.social_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read likes" ON public.social_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "own likes" ON public.social_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own likes delete" ON public.social_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.social_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, DELETE ON public.social_comments TO authenticated;
GRANT ALL ON public.social_comments TO service_role;
ALTER TABLE public.social_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read comments" ON public.social_comments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.social_posts p WHERE p.id = post_id AND (p.organization_id IS NULL OR public.is_org_member(p.organization_id, auth.uid())))
);
CREATE POLICY "own comments" ON public.social_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own comments delete" ON public.social_comments FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE INDEX social_posts_created_idx ON public.social_posts (created_at DESC);
CREATE INDEX social_comments_post_idx ON public.social_comments (post_id);
CREATE INDEX social_likes_post_idx ON public.social_likes (post_id);