ALTER TABLE public.notebook_pages
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '';

UPDATE public.notebook_pages
SET title = 'ページ ' || (page_index + 1)::text
WHERE title = '';