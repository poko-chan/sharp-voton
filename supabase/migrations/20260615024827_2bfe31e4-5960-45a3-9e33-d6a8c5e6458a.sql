
DROP VIEW IF EXISTS public.weekly_coin_leaderboard;
CREATE VIEW public.weekly_coin_leaderboard
WITH (security_invoker = true) AS
SELECT
  t.user_id,
  p.display_name,
  p.avatar_url,
  COALESCE(SUM(t.amount) FILTER (WHERE t.amount > 0), 0)::int AS coins_earned,
  date_trunc('week', now())::date AS week_start
FROM public.coin_transactions t
JOIN public.profiles p ON p.id = t.user_id
WHERE t.created_at >= date_trunc('week', now())
GROUP BY t.user_id, p.display_name, p.avatar_url
ORDER BY coins_earned DESC;
GRANT SELECT ON public.weekly_coin_leaderboard TO authenticated;
