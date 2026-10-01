ALTER TABLE public.parent_missions ADD COLUMN IF NOT EXISTS reward_text text;
ALTER TABLE public.parent_missions ADD COLUMN IF NOT EXISTS rewarded_at timestamptz;
DO $$ DECLARE c record; BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.parent_missions'::regclass AND contype='c' AND pg_get_constraintdef(oid) ILIKE '%status%' LOOP
    EXECUTE format('ALTER TABLE public.parent_missions DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.parent_missions ADD CONSTRAINT parent_missions_status_check CHECK (status IN ('open','claimed','done','rewarded'));