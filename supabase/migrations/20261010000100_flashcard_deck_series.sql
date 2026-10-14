ALTER TABLE public.flashcard_decks
  ADD COLUMN IF NOT EXISTS series text NOT NULL DEFAULT '';