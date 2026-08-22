-- Sprint D: Onboarding v2 — profile fields + orient_card_seen.
--
-- Already applied to Supabase — reconstructed from the live schema
-- (information_schema, pg_constraint, pg_policies) for repo record keeping.

-- ---------------------------------------------------------------------------
-- profiles — onboarding + preference columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS taste_categories text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS typical_group_size text,
  ADD COLUMN IF NOT EXISTS typical_spend text;

-- ---------------------------------------------------------------------------
-- orient_card_seen
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orient_card_seen (
  user_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  knot_id  uuid NOT NULL REFERENCES public.knots(id) ON DELETE CASCADE,
  seen_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, knot_id)
);

ALTER TABLE public.orient_card_seen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orient_card_seen_all ON public.orient_card_seen;
CREATE POLICY orient_card_seen_all ON public.orient_card_seen
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
