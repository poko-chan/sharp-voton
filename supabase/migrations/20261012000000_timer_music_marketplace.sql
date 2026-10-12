INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('timer-music', 'timer-music', true, 52428800)
ON CONFLICT (id) DO UPDATE
SET public = true, file_size_limit = 52428800;

CREATE TABLE public.timer_music_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  cover_path text NOT NULL,
  audio_path text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.timer_music_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timer music tracks read published"
ON public.timer_music_tracks FOR SELECT TO authenticated
USING (is_active OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "timer music tracks admin manage"
ON public.timer_music_tracks FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.timer_music_favorites (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES public.timer_music_tracks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, track_id)
);

ALTER TABLE public.timer_music_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timer music favorites read own"
ON public.timer_music_favorites FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "timer music favorites add own"
ON public.timer_music_favorites FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.timer_music_tracks
    WHERE id = track_id AND is_active
  )
);

CREATE POLICY "timer music favorites remove own"
ON public.timer_music_favorites FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "timer music files public read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'timer-music');

CREATE POLICY "timer music files admin manage"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'timer-music' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'timer-music' AND public.has_role(auth.uid(), 'admin'));