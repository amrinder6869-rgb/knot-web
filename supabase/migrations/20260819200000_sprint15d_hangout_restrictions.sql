-- Sprint 15d: hangout-level event restrictions and per-guest restrictions.
--
-- Already applied to Supabase — reconstructed from the live schema
-- (information_schema) for repo record keeping.

ALTER TABLE public.hangouts
  ADD COLUMN IF NOT EXISTS event_restrictions text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.hangout_rsvps
  ADD COLUMN IF NOT EXISTS guest_dietary text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS guest_accessibility text[] NOT NULL DEFAULT '{}';

NOTIFY pgrst, 'reload schema';
