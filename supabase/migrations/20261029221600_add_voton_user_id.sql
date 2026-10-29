ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS voton_user_id text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_voton_user_id_key
  ON public.profiles (voton_user_id)
  WHERE voton_user_id IS NOT NULL;
