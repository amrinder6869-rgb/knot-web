-- Vibes (point_transactions) INSERT is blocked by RLS.
-- App tables: there are no vibes / vibes_transactions / user_vibes tables.
-- Reads and writes go to public.point_transactions (VibesCounter, RewardsShop,
-- PostHangoutLoop, CrewSection). Seed inserts failed with:
--   new row violates row-level security policy for table "point_transactions"
--
-- Inspect first (do not assume policy names):
--
--   SELECT policyname, cmd, qual, with_check
--   FROM pg_policies
--   WHERE tablename IN ('vibes_transactions', 'vibes', 'user_vibes', 'point_transactions');
--
-- Apply this INSERT policy if INSERT is missing or WITH CHECK blocks auth.uid().
-- SELECT already works in production (the badge reads 0, it does not error).

ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS point_transactions_insert_own ON public.point_transactions;
CREATE POLICY point_transactions_insert_own ON public.point_transactions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
