DROP POLICY IF EXISTS "all read anon" ON public.anonymous_reflections;

CREATE POLICY "own read anon"
ON public.anonymous_reflections
FOR SELECT
TO authenticated
USING (auth.uid() = author_id);

REVOKE SELECT ON public.anonymous_reflections FROM anon;