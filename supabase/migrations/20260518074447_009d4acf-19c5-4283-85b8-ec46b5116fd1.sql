ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS count_from timestamptz;
UPDATE public.goals SET count_from = created_at WHERE count_from IS NULL;