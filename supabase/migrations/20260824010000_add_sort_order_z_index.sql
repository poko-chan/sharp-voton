-- Add sort_order to subjects for user-controlled ordering
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Backfill sort_order based on existing created_at ordering per user
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) - 1 AS rn
  FROM public.subjects
)
UPDATE public.subjects s SET sort_order = ranked.rn
FROM ranked WHERE ranked.id = s.id;

-- Add z_index to sticky_notes for front/back ordering
ALTER TABLE public.sticky_notes ADD COLUMN IF NOT EXISTS z_index integer NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) AS rn
  FROM public.sticky_notes
)
UPDATE public.sticky_notes sn SET z_index = ranked.rn
FROM ranked WHERE ranked.id = sn.id;

-- Ensure RLS + grants remain intact (subjects/sticky_notes already have RLS enabled;
-- these ALTER TABLE ADD COLUMN operations do not affect existing policies).
