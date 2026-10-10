ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;