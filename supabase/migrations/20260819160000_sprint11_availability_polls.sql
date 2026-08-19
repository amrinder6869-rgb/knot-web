-- Sprint 11: calendar availability poll in the hangout composer.
--
-- Sections 1-3 are already applied to Supabase — reconstructed from the live
-- schema (information_schema, pg_constraint, pg_policies) for repo record
-- keeping.
--
-- Sections 4-5 are NEW, drafted here but NOT yet applied. See the notes on
-- each.

-- ---------------------------------------------------------------------------
-- 1. availability_polls
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.availability_polls (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hangout_id  uuid REFERENCES public.hangouts(id) ON DELETE CASCADE,
  knot_id     uuid NOT NULL REFERENCES public.knots(id) ON DELETE CASCADE,
  created_by  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       text,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  closed_at   timestamptz
);

ALTER TABLE public.availability_polls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS availability_polls_select ON public.availability_polls;
CREATE POLICY availability_polls_select ON public.availability_polls
  FOR SELECT TO authenticated USING (is_knot_member(knot_id));

DROP POLICY IF EXISTS availability_polls_insert ON public.availability_polls;
CREATE POLICY availability_polls_insert ON public.availability_polls
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND is_knot_member(knot_id));

DROP POLICY IF EXISTS availability_polls_update ON public.availability_polls;
CREATE POLICY availability_polls_update ON public.availability_polls
  FOR UPDATE TO authenticated USING (created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. availability_poll_options
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.availability_poll_options (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id      uuid NOT NULL REFERENCES public.availability_polls(id) ON DELETE CASCADE,
  date_option  date NOT NULL,
  time_option  time,
  sort_order   integer NOT NULL DEFAULT 0
);

ALTER TABLE public.availability_poll_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS poll_options_select ON public.availability_poll_options;
CREATE POLICY poll_options_select ON public.availability_poll_options
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM availability_polls WHERE id = availability_poll_options.poll_id AND is_knot_member(knot_id))
  );

DROP POLICY IF EXISTS poll_options_insert ON public.availability_poll_options;
CREATE POLICY poll_options_insert ON public.availability_poll_options
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM availability_polls WHERE id = availability_poll_options.poll_id AND created_by = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 3. availability_poll_responses
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.availability_poll_responses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id     uuid NOT NULL REFERENCES public.availability_polls(id) ON DELETE CASCADE,
  option_id   uuid NOT NULL REFERENCES public.availability_poll_options(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  available   text NOT NULL DEFAULT 'yes' CHECK (available IN ('yes', 'maybe', 'no')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (option_id, user_id)
);

ALTER TABLE public.availability_poll_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS poll_responses_select ON public.availability_poll_responses;
CREATE POLICY poll_responses_select ON public.availability_poll_responses
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM availability_polls ap WHERE ap.id = availability_poll_responses.poll_id AND is_knot_member(ap.knot_id))
  );

-- As originally applied: no knot-membership check on insert, only
-- user_id = auth.uid(). See section 5 for the tightened version.
DROP POLICY IF EXISTS poll_responses_insert ON public.availability_poll_responses;
CREATE POLICY poll_responses_insert ON public.availability_poll_responses
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS poll_responses_update ON public.availability_poll_responses;
CREATE POLICY poll_responses_update ON public.availability_poll_responses
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- availability_poll_responses is already in the supabase_realtime
-- publication — AvailabilityPoll's live subscription works today with no
-- publication changes needed.

-- ---------------------------------------------------------------------------
-- 4. NEW — not yet applied. Required for "Post a poll post to the feed".
--
-- posts.valid_post_type is ['moment','hangout','bill','system','treat',
-- 'settled'] — 'poll' is not in it, so Composer's post_type: 'poll' insert
-- for a poll-mode hangout would be rejected outright by this check
-- constraint. This widens the allowed list to include it; nothing existing
-- is removed.
-- ---------------------------------------------------------------------------
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS valid_post_type;
ALTER TABLE public.posts ADD CONSTRAINT valid_post_type
  CHECK (post_type = ANY (ARRAY['moment', 'hangout', 'bill', 'system', 'treat', 'settled', 'poll']));

-- ---------------------------------------------------------------------------
-- 5. NEW — not yet applied. Security tightening, not required for this
-- sprint's frontend to function (the looser policy in section 3 still
-- works), but poll_responses_insert as originally applied has no
-- knot-membership check — any authenticated user who can guess or observe a
-- poll_id/option_id can insert a response for someone else's knot poll. This
-- scopes it the same way poll_options_insert already is.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS poll_responses_insert ON public.availability_poll_responses;
CREATE POLICY poll_responses_insert ON public.availability_poll_responses
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM availability_polls ap WHERE ap.id = availability_poll_responses.poll_id AND is_knot_member(ap.knot_id))
  );

NOTIFY pgrst, 'reload schema';
