CREATE TABLE public.timer_music_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  cover_path text NOT NULL,
  audio_path text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.timer_music_tracks TO authenticated;
GRANT ALL ON public.timer_music_tracks TO service_role;
ALTER TABLE public.timer_music_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "timer music tracks read published" ON public.timer_music_tracks FOR SELECT TO authenticated
USING (is_active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "timer music tracks admin manage" ON public.timer_music_tracks FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.timer_music_favorites (
  user_id uuid NOT NULL,
  track_id uuid NOT NULL REFERENCES public.timer_music_tracks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, track_id)
);
GRANT SELECT, INSERT, DELETE ON public.timer_music_favorites TO authenticated;
GRANT ALL ON public.timer_music_favorites TO service_role;
ALTER TABLE public.timer_music_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "timer music favorites read own" ON public.timer_music_favorites FOR SELECT TO authenticated
USING (auth.uid() = user_id);
CREATE POLICY "timer music favorites add own" ON public.timer_music_favorites FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.timer_music_tracks t WHERE t.id = track_id AND t.is_active));
CREATE POLICY "timer music favorites remove own" ON public.timer_music_favorites FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "timer music files signed-in read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'timer-music');
CREATE POLICY "timer music files admin insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'timer-music' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "timer music files admin update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'timer-music' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "timer music files admin delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'timer-music' AND public.has_role(auth.uid(), 'admin'));