-- Adds planning_status to create_hangout(p_input jsonb).
-- Signature is unchanged: one argument, p_input jsonb.
-- Default is 'planning' (hangouts_planning_status_check allows
-- planning|draft|locked|abandoned; 'voting' is hangouts.status, not this column).
-- Run this in the Supabase SQL editor. Do not apply via the agent.

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
    is_standalone, standalone_token,
    planning_status
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
    p_input->>'standalone_token',
    COALESCE(NULLIF(p_input->>'planning_status', ''), 'planning')
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
