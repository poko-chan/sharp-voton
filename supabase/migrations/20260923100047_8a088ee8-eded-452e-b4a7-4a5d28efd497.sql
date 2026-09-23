CREATE TABLE public.plan_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
CREATE TABLE public.plans (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.plan_groups(id) on delete cascade,
  name text not null,
  description text,
  price_monthly int not null default 0,
  price_yearly int not null default 0,
  currency text not null default 'jpy',
  highlight boolean not null default false,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
CREATE TABLE public.plan_features (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  kind text not null default 'bool' check (kind in ('bool','text')),
  label text not null,
  bool_value boolean not null default false,
  text_value text,
  sort_order int not null default 0
);
CREATE TABLE public.plan_packs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price int not null default 0,
  currency text not null default 'jpy',
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
CREATE INDEX plans_group_idx ON public.plans(group_id);
CREATE INDEX plan_features_plan_idx ON public.plan_features(plan_id);

GRANT SELECT ON public.plan_groups, public.plans, public.plan_features, public.plan_packs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_groups, public.plans, public.plan_features, public.plan_packs TO authenticated;
GRANT ALL ON public.plan_groups, public.plans, public.plan_features, public.plan_packs TO service_role;

ALTER TABLE public.plan_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY plan_groups_read ON public.plan_groups FOR SELECT USING (active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY plan_groups_admin ON public.plan_groups FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY plans_read ON public.plans FOR SELECT USING (active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY plans_admin ON public.plans FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY plan_features_read ON public.plan_features FOR SELECT USING (EXISTS (SELECT 1 FROM public.plans p WHERE p.id = plan_id AND (p.active OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY plan_features_admin ON public.plan_features FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY plan_packs_read ON public.plan_packs FOR SELECT USING (active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY plan_packs_admin ON public.plan_packs FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS fl_read ON public.follows;
CREATE POLICY fl_read ON public.follows FOR SELECT TO authenticated USING (auth.uid() = follower_id OR auth.uid() = following_id);

DROP POLICY IF EXISTS sr_read_all ON public.service_restrictions;
CREATE POLICY sr_read_all ON public.service_restrictions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS nav_read_all ON public.admin_nav_config;
CREATE POLICY nav_read_all ON public.admin_nav_config FOR SELECT TO authenticated USING (visible OR public.has_role(auth.uid(),'admin'));
