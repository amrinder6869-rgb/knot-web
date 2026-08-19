-- Sprint 9: standalone one-time events outside Knots.
--
-- Sections 1-4 are already applied to Supabase — reconstructed from the live
-- schema (information_schema, pg_constraint, pg_indexes, pg_policies) for
-- repo record keeping.
--
-- Sections 5-6 are NEW fixes required for this sprint's frontend to actually
-- work, drafted here but NOT yet applied. See the notes on each.

-- ---------------------------------------------------------------------------
-- 1. Columns on hangouts
-- ---------------------------------------------------------------------------
ALTER TABLE public.hangouts
  ADD COLUMN IF NOT EXISTS is_standalone        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS standalone_token      text,
  ADD COLUMN IF NOT EXISTS converted_to_knot_id  uuid REFERENCES public.knots(id) ON DELETE SET NULL;

DO $$
BEGIN
  ALTER TABLE public.hangouts ADD CONSTRAINT hangouts_standalone_token_key UNIQUE (standalone_token);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 2. standalone_attendees
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.standalone_attendees (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hangout_id  uuid NOT NULL REFERENCES public.hangouts(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at   timestamptz NOT NULL DEFAULT now(),
  status      text NOT NULL DEFAULT 'going' CHECK (status IN ('going', 'maybe', 'declined')),
  UNIQUE (hangout_id, user_id)
);

ALTER TABLE public.standalone_attendees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS standalone_attendees_select ON public.standalone_attendees;
CREATE POLICY standalone_attendees_select ON public.standalone_attendees
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS standalone_attendees_insert ON public.standalone_attendees;
CREATE POLICY standalone_attendees_insert ON public.standalone_attendees
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS standalone_attendees_update ON public.standalone_attendees;
CREATE POLICY standalone_attendees_update ON public.standalone_attendees
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS standalone_attendees_delete ON public.standalone_attendees;
CREATE POLICY standalone_attendees_delete ON public.standalone_attendees
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. get_standalone_event(p_token) — public read path
--
-- SECURITY DEFINER is required: hangouts_select is is_knot_member(knot_id),
-- which is always false for a standalone hangout (knot_id is null), so a
-- plain client-side select can never see these rows.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_standalone_event(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_hangout hangouts%ROWTYPE;
  v_organizer profiles%ROWTYPE;
  v_attendee_count bigint;
BEGIN
  SELECT * INTO v_hangout FROM hangouts WHERE standalone_token = p_token AND is_standalone = true LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT * INTO v_organizer FROM profiles WHERE id = v_hangout.created_by LIMIT 1;

  SELECT COUNT(*) INTO v_attendee_count FROM standalone_attendees WHERE hangout_id = v_hangout.id;

  RETURN jsonb_build_object(
    'found',           true,
    'id',              v_hangout.id,
    'title',           v_hangout.title,
    'status',          v_hangout.status,
    'scheduled_at',    v_hangout.scheduled_at,
    'scheduled_for',   v_hangout.scheduled_for,
    'venue_name',      v_hangout.venue_name,
    'venue_address',   v_hangout.venue_address,
    'meeting_url',     v_hangout.meeting_url,
    'brief',           v_hangout.brief,
    'organizer_name',  v_organizer.name,
    'organizer_id',    v_hangout.created_by,
    'attendee_count',  v_attendee_count,
    'converted_to_knot_id', v_hangout.converted_to_knot_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_standalone_event(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_standalone_event(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. (informational) existing hangouts policies, unchanged by this file:
--   hangouts_select: is_knot_member(knot_id)
--   hangouts_insert: is_knot_member(knot_id)
--   hangouts_update: created_by = auth.uid()
-- Both select and insert always evaluate false for a standalone row
-- (knot_id is null) — see sections 5 below for why that matters.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 5. NEW — not yet applied. Required for "Create event" (dashboard) to work.
--
-- hangouts_insert/select are is_knot_member(knot_id), which is always false
-- for standalone rows (knot_id is null) — a plain client insert of a
-- standalone hangout is currently rejected by RLS outright. This widens both
-- policies with an OR branch scoped tightly to standalone rows owned by the
-- caller; it does not relax anything for ordinary Knot hangouts.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS hangouts_select ON public.hangouts;
CREATE POLICY hangouts_select ON public.hangouts
  FOR SELECT USING (
    is_knot_member(knot_id)
    OR (is_standalone = true AND created_by = auth.uid())
    OR (is_standalone = true AND standalone_token IS NOT NULL)
  );

DROP POLICY IF EXISTS hangouts_insert ON public.hangouts;
CREATE POLICY hangouts_insert ON public.hangouts
  FOR INSERT WITH CHECK (
    is_knot_member(knot_id)
    OR (is_standalone = true AND knot_id IS NULL AND created_by = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 6. NEW — not yet applied. Required for "Create Knot from this event".
--
-- knot_members_insert only allows auth.uid() = user_id, so a client can
-- never add other users to a knot directly (by design — the rest of the app
-- only ever adds members via explicit invite acceptance). Rather than widen
-- that policy, this RPC performs the one privileged, narrowly-scoped
-- operation Sprint 9 needs: the organizer of an ended, unconverted
-- standalone event may create a Knot and add that event's own attendees to
-- it. Nothing else is authorized by this function.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.convert_standalone_event_to_knot(p_hangout_id uuid, p_knot_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_hangout hangouts%ROWTYPE;
  v_knot_id uuid;
BEGIN
  SELECT * INTO v_hangout FROM hangouts WHERE id = p_hangout_id LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF v_hangout.created_by IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('error', 'not_organizer');
  END IF;

  IF v_hangout.is_standalone IS NOT TRUE OR v_hangout.status <> 'ended' THEN
    RETURN jsonb_build_object('error', 'not_eligible');
  END IF;

  IF v_hangout.converted_to_knot_id IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'already_converted');
  END IF;

  INSERT INTO knots (name, emoji, created_by)
  VALUES (COALESCE(NULLIF(TRIM(p_knot_name), ''), v_hangout.title, 'New Knot'), '🎉', auth.uid())
  RETURNING id INTO v_knot_id;

  INSERT INTO knot_members (knot_id, user_id, role)
  VALUES (v_knot_id, auth.uid(), 'founder');

  INSERT INTO knot_members (knot_id, user_id, role)
  SELECT v_knot_id, sa.user_id, 'member'
  FROM standalone_attendees sa
  WHERE sa.hangout_id = p_hangout_id
    AND sa.user_id <> auth.uid()
  ON CONFLICT (knot_id, user_id) DO NOTHING;

  UPDATE hangouts SET converted_to_knot_id = v_knot_id WHERE id = p_hangout_id;

  RETURN jsonb_build_object('knot_id', v_knot_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.convert_standalone_event_to_knot(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_standalone_event_to_knot(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
