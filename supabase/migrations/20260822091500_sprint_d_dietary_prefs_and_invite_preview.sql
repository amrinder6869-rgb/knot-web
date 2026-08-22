-- Sprint D follow-up: dietary_preferences column + richer invite preview.
--
-- Applied directly in this sprint (not part of the pre-applied Sprint D
-- migration). The onboarding UI spec calls for a three-state (unset/prefer/
-- avoid) dietary signal, distinct from the existing flat profiles.dietary_restrictions
-- array — that column is already read elsewhere (Discover.tsx, BillSplitForm,
-- HangoutCard) as a plain list of hard restrictions, so overloading it with
-- prefer/avoid encoding would corrupt those displays. dietary_preferences is
-- a separate jsonb map (e.g. {"vegan": "avoid", "halal": "prefer"}) so the
-- existing column's contract is untouched.
--
-- get_invite_preview additionally returns inviter_name, member_count, and
-- member_names (first names, up to 4, ordered by joined_at) so the invite
-- landing page can show who's already inside without needing knot_members
-- read access before the invite is redeemed.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dietary_preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.get_invite_preview(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invite invites%ROWTYPE;
  v_knot   knots%ROWTYPE;
  v_inviter_name text;
  v_member_count integer;
  v_member_names text[];
BEGIN
  SELECT * INTO v_invite FROM invites WHERE token = p_token LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('found', true, 'expired', true);
  END IF;

  IF v_invite.used_by IS NOT NULL THEN
    RETURN jsonb_build_object('found', true, 'used', true);
  END IF;

  SELECT * INTO v_knot FROM knots WHERE id = v_invite.knot_id LIMIT 1;

  SELECT name INTO v_inviter_name FROM profiles WHERE id = v_invite.created_by;

  SELECT count(*) INTO v_member_count FROM knot_members WHERE knot_id = v_invite.knot_id;

  SELECT coalesce(array_agg(first_name), ARRAY[]::text[]) INTO v_member_names
  FROM (
    SELECT split_part(p.name, ' ', 1) AS first_name
    FROM knot_members km
    JOIN profiles p ON p.id = km.user_id
    WHERE km.knot_id = v_invite.knot_id
    ORDER BY km.joined_at ASC
    LIMIT 4
  ) t;

  RETURN jsonb_build_object(
    'found',        true,
    'expired',      false,
    'used',         false,
    'knot_id',      v_invite.knot_id,
    'knot_name',    v_knot.name,
    'knot_emoji',   v_knot.emoji,
    'created_by',   v_invite.created_by,
    'inviter_name', v_inviter_name,
    'member_count', v_member_count,
    'member_names', v_member_names
  );
END;
$function$;

NOTIFY pgrst, 'reload schema';
