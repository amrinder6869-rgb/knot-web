-- Sprint 15c: member dietary restrictions / accessibility needs profile.
--
-- Already applied to Supabase — reconstructed from the live schema
-- (information_schema) for repo record keeping.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dietary_restrictions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS accessibility_needs text[] NOT NULL DEFAULT '{}';

NOTIFY pgrst, 'reload schema';
