ALTER TABLE public.flashcards ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.flashcard_decks ADD COLUMN IF NOT EXISTS series text NOT NULL DEFAULT '';