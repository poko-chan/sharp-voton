
create or replace function public.my_material_usage()
returns table (
  material_id uuid,
  sessions_count bigint,
  total_minutes bigint,
  days_used bigint,
  first_used date,
  last_used date,
  daily_avg numeric
)
language sql
security definer
set search_path = public
as $$
  with base as (
    select l.id, l.date, coalesce(l.duration_minutes,0) as duration_minutes,
           coalesce(
             nullif(l.material_ids, '{}'::uuid[]),
             case when l.material_id is not null then array[l.material_id]::uuid[] else '{}'::uuid[] end
           ) as mids
    from public.study_logs l
    where l.user_id = auth.uid()
  ), exploded as (
    select unnest(mids) as material_id, id, date, duration_minutes from base
  )
  select material_id,
         count(distinct id)::bigint as sessions_count,
         coalesce(sum(duration_minutes),0)::bigint as total_minutes,
         count(distinct date)::bigint as days_used,
         min(date) as first_used,
         max(date) as last_used,
         case
           when (max(date) - min(date) + 1) > 0
             then round(coalesce(sum(duration_minutes),0)::numeric / (max(date) - min(date) + 1), 1)
           else coalesce(sum(duration_minutes),0)::numeric
         end as daily_avg
  from exploded
  group by material_id;
$$;
grant execute on function public.my_material_usage() to authenticated;

create or replace function public.material_global_usage(_material_id uuid)
returns table (
  users_count bigint,
  sessions_count bigint,
  total_minutes bigint,
  last_used date
)
language sql
security definer
set search_path = public
as $$
  with base as (
    select l.user_id, l.id, l.date, coalesce(l.duration_minutes,0) as duration_minutes
    from public.study_logs l
    where _material_id = any(coalesce(l.material_ids, '{}'::uuid[]))
       or l.material_id = _material_id
  )
  select count(distinct user_id)::bigint,
         count(distinct id)::bigint,
         coalesce(sum(duration_minutes),0)::bigint,
         max(date)
  from base;
$$;
grant execute on function public.material_global_usage(uuid) to authenticated;
