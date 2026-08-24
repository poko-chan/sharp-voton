ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at) AS rn
  FROM public.subjects
)
UPDATE public.subjects s SET sort_order = r.rn FROM ranked r WHERE r.id = s.id AND s.sort_order = 0;
CREATE INDEX IF NOT EXISTS subjects_user_sort_idx ON public.subjects (user_id, sort_order);