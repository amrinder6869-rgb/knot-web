-- Fix: infinite recursion in is_knot_member(), surfacing as 500s on
-- knot_members, knots, and every other table whose RLS policy calls it
-- (hangouts, bills, posts, photos, games, reactions, settlements, invites,
-- hangout_rsvps, hangout_options, hangout_votes, and more).
--
-- is_knot_member() queries knot_members internally. Without SECURITY
-- DEFINER, that internal query is itself subject to knot_members' own
-- SELECT policy ("(user_id = auth.uid()) OR is_knot_member(knot_id)"),
-- which calls is_knot_member() again -> infinite recursion (Postgres
-- 42P17 / stack depth exceeded), which PostgREST reports as a 500.
--
-- SECURITY DEFINER makes the internal knot_members lookup bypass RLS,
-- same pattern already used by get_public_profile (see
-- 20260818120000_public_profiles.sql). Safe here: the function only
-- returns a boolean membership check, never row data, and CREATE OR
-- REPLACE preserves the function's existing grants (EXECUTE to PUBLIC),
-- so no grant changes are needed.
CREATE OR REPLACE FUNCTION public.is_knot_member(p_knot_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.knot_members
    WHERE knot_id = p_knot_id
    AND user_id = auth.uid()
  )
$function$;

NOTIFY pgrst, 'reload schema';
