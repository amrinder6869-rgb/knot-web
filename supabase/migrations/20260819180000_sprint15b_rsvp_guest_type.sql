-- Sprint 15b: RSVP guest type, headcount, and bill duplicate detection.
--
-- Already applied to Supabase — reconstructed from the live schema
-- (information_schema, pg_constraint) for repo record keeping.

-- ---------------------------------------------------------------------------
-- hangout_rsvps: guest type / headcount
-- ---------------------------------------------------------------------------
ALTER TABLE public.hangout_rsvps
  ADD COLUMN IF NOT EXISTS guest_type text NOT NULL DEFAULT 'just_me',
  ADD COLUMN IF NOT EXISTS guest_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS guest_restrictions jsonb;

ALTER TABLE public.hangout_rsvps DROP CONSTRAINT IF EXISTS hangout_rsvps_guest_type_check;
ALTER TABLE public.hangout_rsvps ADD CONSTRAINT hangout_rsvps_guest_type_check
  CHECK (guest_type = ANY (ARRAY['just_me', 'plus_one', 'family']));

-- ---------------------------------------------------------------------------
-- bills: receipt fingerprint for duplicate detection
-- ---------------------------------------------------------------------------
ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS receipt_hash text;

NOTIFY pgrst, 'reload schema';
