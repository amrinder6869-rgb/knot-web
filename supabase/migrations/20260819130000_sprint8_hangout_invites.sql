-- Sprint 8: hangout guest list control and surprise mode.
-- Already applied to Supabase — this file is committed for repo record
-- keeping, reconstructed from the live schema (information_schema,
-- pg_constraint, pg_indexes, pg_policies) rather than authored fresh.

CREATE TABLE IF NOT EXISTS public.hangout_invites (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hangout_id   uuid NOT NULL REFERENCES public.hangouts(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_by   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  is_surprise  boolean NOT NULL DEFAULT false,
  reveal_at    timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hangout_id, user_id)
);

CREATE INDEX IF NOT EXISTS hangout_invites_hangout_idx ON public.hangout_invites (hangout_id);
CREATE INDEX IF NOT EXISTS hangout_invites_user_idx ON public.hangout_invites (user_id);

ALTER TABLE public.hangouts
  ADD COLUMN IF NOT EXISTS is_surprise  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reveal_at    timestamptz,
  ADD COLUMN IF NOT EXISTS invite_mode  text NOT NULL DEFAULT 'all';

DO $$
BEGIN
  ALTER TABLE public.hangouts
    ADD CONSTRAINT hangouts_invite_mode_check
    CHECK (invite_mode IN ('all', 'selected'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.hangout_invites ENABLE ROW LEVEL SECURITY;

-- Any knot member can see invite rows for hangouts in their knot (needed so
-- the feed can determine who is on a surprise hangout's hidden list), plus
-- the invitee and inviter can always see their own rows regardless.
DROP POLICY IF EXISTS hangout_invites_select ON public.hangout_invites;
CREATE POLICY hangout_invites_select ON public.hangout_invites
  FOR SELECT USING (
    user_id = auth.uid()
    OR invited_by = auth.uid()
    OR is_knot_member((SELECT knot_id FROM public.hangouts WHERE id = hangout_invites.hangout_id LIMIT 1))
  );

DROP POLICY IF EXISTS hangout_invites_insert ON public.hangout_invites;
CREATE POLICY hangout_invites_insert ON public.hangout_invites
  FOR INSERT WITH CHECK (invited_by = auth.uid());

DROP POLICY IF EXISTS hangout_invites_update ON public.hangout_invites;
CREATE POLICY hangout_invites_update ON public.hangout_invites
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS hangout_invites_delete ON public.hangout_invites;
CREATE POLICY hangout_invites_delete ON public.hangout_invites
  FOR DELETE USING (invited_by = auth.uid());

NOTIFY pgrst, 'reload schema';
