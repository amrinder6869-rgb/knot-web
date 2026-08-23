-- Sprint E: Group decision flow, poll-first venue selection.
--
-- The hangout_options/hangout_option_votes schema below was already applied
-- to Supabase before this sprint started — reconstructed here from the live
-- schema (information_schema, pg_constraint, pg_policies) for repo record
-- keeping. The create_hangout() change at the bottom was written and applied
-- in this sprint.

-- ---------------------------------------------------------------------------
-- hangout_options — venue columns added alongside the existing generic
-- label/emoji/vote_count option-vote feature. A row is a "venue poll option"
-- when venue_name is set or is_none_of_these is true; HangoutCard.tsx uses
-- that to route to VenuePoll instead of the older generic options UI.
-- ---------------------------------------------------------------------------
ALTER TABLE public.hangout_options
  ADD COLUMN IF NOT EXISTS venue_place_id text,
  ADD COLUMN IF NOT EXISTS venue_name text,
  ADD COLUMN IF NOT EXISTS venue_address text,
  ADD COLUMN IF NOT EXISTS venue_lat double precision,
  ADD COLUMN IF NOT EXISTS venue_lng double precision,
  ADD COLUMN IF NOT EXISTS venue_category text,
  ADD COLUMN IF NOT EXISTS venue_photo_url text,
  ADD COLUMN IF NOT EXISTS venue_rating double precision,
  ADD COLUMN IF NOT EXISTS price_level integer,
  ADD COLUMN IF NOT EXISTS restriction_notes text,
  ADD COLUMN IF NOT EXISTS is_none_of_these boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- hangout_option_votes — one vote per hangout per user (unlike the older
-- hangout_votes table this deliberately does not touch or reuse).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hangout_option_votes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id   uuid NOT NULL REFERENCES public.hangout_options(id) ON DELETE CASCADE,
  hangout_id  uuid NOT NULL REFERENCES public.hangouts(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hangout_id, user_id)
);

ALTER TABLE public.hangout_option_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS option_votes_select ON public.hangout_option_votes;
CREATE POLICY option_votes_select ON public.hangout_option_votes
  FOR SELECT TO authenticated
  USING (is_knot_member((SELECT knot_id FROM hangouts WHERE id = hangout_option_votes.hangout_id LIMIT 1)));

DROP POLICY IF EXISTS option_votes_insert ON public.hangout_option_votes;
CREATE POLICY option_votes_insert ON public.hangout_option_votes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_knot_member((SELECT knot_id FROM hangouts WHERE id = hangout_option_votes.hangout_id LIMIT 1)));

DROP POLICY IF EXISTS option_votes_delete ON public.hangout_option_votes;
CREATE POLICY option_votes_delete ON public.hangout_option_votes
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.hangout_option_votes;

-- ---------------------------------------------------------------------------
-- create_hangout() — insert one hangout_options row per p_input->'venue_options'
-- entry, mirroring the existing poll_options -> availability_poll_options loop.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_hangout(p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_hangout_id    uuid;
  v_post_id       uuid;
  v_poll_id       uuid;
  v_knot_id       uuid;
  v_user_id       uuid;
  v_invite_mode   text;
  v_is_surprise   boolean;
  v_reveal_at     timestamptz;
  v_selected_ids  uuid[];
  v_all_member_ids uuid[];
  v_surprise_ids  uuid[];
  v_poll_options  jsonb;
  v_opt           jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  v_knot_id     := (p_input->>'knot_id')::uuid;
  v_invite_mode := COALESCE(p_input->>'invite_mode', 'all');
  v_is_surprise := COALESCE((p_input->>'is_surprise')::boolean, false);
  v_reveal_at   := (p_input->>'reveal_at')::timestamptz;

  IF NOT is_knot_member(v_knot_id) THEN
    RETURN jsonb_build_object('error', 'not_member');
  END IF;

  INSERT INTO hangouts (
    knot_id, created_by, title, status, type,
    scheduled_for, duration_minutes,
    venue_name, venue_address, venue_place_id, venue_lat, venue_lng,
    venue_category, venue_maps_url, venue_booking_url,
    meeting_url,
    brief, brief_vibe, brief_budget, brief_headcount,
    movie_title, movie_showtime,
    event_restrictions,
    invite_mode, is_surprise, reveal_at,
    is_standalone, standalone_token
  ) VALUES (
    v_knot_id,
    v_user_id,
    p_input->>'title',
    'voting',
    COALESCE(p_input->>'type', 'planned'),
    (p_input->>'scheduled_for')::timestamptz,
    (p_input->>'duration_minutes')::integer,
    p_input->>'venue_name',
    p_input->>'venue_address',
    p_input->>'venue_place_id',
    (p_input->>'venue_lat')::float,
    (p_input->>'venue_lng')::float,
    p_input->>'venue_category',
    p_input->>'venue_maps_url',
    p_input->>'venue_booking_url',
    p_input->>'meeting_url',
    p_input->>'brief',
    p_input->>'brief_vibe',
    p_input->>'brief_budget',
    (p_input->>'brief_headcount')::integer,
    p_input->>'movie_title',
    (p_input->>'movie_showtime')::timestamptz,
    CASE WHEN p_input->'event_restrictions' IS NOT NULL
      THEN ARRAY(SELECT jsonb_array_elements_text(p_input->'event_restrictions'))
      ELSE '{}'::text[]
    END,
    v_invite_mode,
    v_is_surprise,
    v_reveal_at,
    COALESCE((p_input->>'is_standalone')::boolean, false),
    p_input->>'standalone_token'
  )
  RETURNING id INTO v_hangout_id;

  SELECT ARRAY_AGG(user_id) INTO v_all_member_ids
  FROM knot_members WHERE knot_id = v_knot_id;

  IF p_input->'selected_member_ids' IS NOT NULL THEN
    SELECT ARRAY(SELECT jsonb_array_elements_text(p_input->'selected_member_ids')::uuid)
    INTO v_selected_ids;
  ELSE
    v_selected_ids := v_all_member_ids;
  END IF;

  IF v_is_surprise AND p_input->'surprise_member_ids' IS NOT NULL THEN
    SELECT ARRAY(SELECT jsonb_array_elements_text(p_input->'surprise_member_ids')::uuid)
    INTO v_surprise_ids;
  ELSE
    v_surprise_ids := '{}'::uuid[];
  END IF;

  INSERT INTO hangout_invites (hangout_id, user_id, invited_by, is_surprise, reveal_at)
  SELECT
    v_hangout_id,
    m,
    v_user_id,
    (m = ANY(v_surprise_ids)),
    CASE WHEN m = ANY(v_surprise_ids) THEN v_reveal_at ELSE NULL END
  FROM UNNEST(v_selected_ids) AS m
  WHERE m != v_user_id
  ON CONFLICT (hangout_id, user_id) DO NOTHING;

  IF COALESCE((p_input->>'poll_mode')::boolean, false) THEN
    INSERT INTO availability_polls (hangout_id, knot_id, created_by, title, status)
    VALUES (v_hangout_id, v_knot_id, v_user_id,
      COALESCE(p_input->>'poll_title', 'When works for everyone?'), 'open')
    RETURNING id INTO v_poll_id;

    IF p_input->'poll_options' IS NOT NULL THEN
      FOR v_opt IN SELECT * FROM jsonb_array_elements(p_input->'poll_options')
      LOOP
        INSERT INTO availability_poll_options (poll_id, date_option, time_option, sort_order)
        VALUES (
          v_poll_id,
          (v_opt->>'date')::date,
          (v_opt->>'time')::time,
          COALESCE((v_opt->>'sort_order')::integer, 0)
        );
      END LOOP;
    END IF;
  END IF;

  IF p_input->'venue_options' IS NOT NULL THEN
    FOR v_opt IN SELECT * FROM jsonb_array_elements(p_input->'venue_options')
    LOOP
      INSERT INTO hangout_options (
        hangout_id, label, venue_place_id, venue_name, venue_address,
        venue_lat, venue_lng, venue_category, venue_photo_url, venue_rating,
        price_level, restriction_notes
      )
      VALUES (
        v_hangout_id,
        COALESCE(v_opt->>'venue_name', 'Venue'),
        v_opt->>'venue_place_id',
        v_opt->>'venue_name',
        v_opt->>'venue_address',
        (v_opt->>'venue_lat')::float,
        (v_opt->>'venue_lng')::float,
        v_opt->>'venue_category',
        v_opt->>'venue_photo_url',
        (v_opt->>'venue_rating')::float,
        (v_opt->>'price_level')::integer,
        v_opt->>'restriction_notes'
      );
    END LOOP;
  END IF;

  INSERT INTO posts (knot_id, hangout_id, author_id, content, post_type)
  VALUES (
    v_knot_id,
    v_hangout_id,
    v_user_id,
    COALESCE(p_input->>'post_content', 'planned a hangout'),
    COALESCE(p_input->>'post_type', 'hangout')
  )
  RETURNING id INTO v_post_id;

  UPDATE hangouts SET post_id = v_post_id WHERE id = v_hangout_id;

  RETURN jsonb_build_object(
    'hangout_id', v_hangout_id,
    'post_id',    v_post_id,
    'poll_id',    v_poll_id
  );
END;
$function$;

NOTIFY pgrst, 'reload schema';
