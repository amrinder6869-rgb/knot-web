-- Sprint 7: public profiles at knot.app/[username]
--
-- Verified against production (vcrnktkttgprbnoyjeff) before writing:
--   profiles HAS      : id, name, avatar_url, budget_tier, equipped_ring_color,
--                       equipped_title, created_at
--   profiles LACKS    : username, bio, resident_city, is_public, privacy_tier
--                       (also: no full_name / display_name / email / city column —
--                        the display name lives in profiles.name)
--   anon SELECT on profiles returns zero rows, so there is currently no
--   anon-readable policy on the table. Nothing here widens table-level access.
--
-- Idempotent throughout, matching 20260724160000_edit_undo_delete_policies.sql.

-- ---------------------------------------------------------------------------
-- 1. Columns
--
-- privacy_tier is the single source of truth for visibility. is_public is a
-- GENERATED column derived from it so the boolean can never drift out of sync
-- with the three-way tier.
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username      TEXT,
  ADD COLUMN IF NOT EXISTS bio           TEXT,
  ADD COLUMN IF NOT EXISTS resident_city TEXT,
  ADD COLUMN IF NOT EXISTS privacy_tier  TEXT NOT NULL DEFAULT 'private';

DO $$
BEGIN
  ALTER TABLE public.profiles
    ADD COLUMN is_public BOOLEAN
    GENERATED ALWAYS AS (privacy_tier = 'public') STORED;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Constraints
--
-- username: 3-20 chars, alphanumeric + underscore, case-insensitively unique.
-- Nullable, because every existing row predates this sprint and has none.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_username_format
    CHECK (username IS NULL OR username ~ '^[A-Za-z0-9_]{3,20}$');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- /[username] sits at the app root, so a username colliding with a real route
-- segment would render that route instead of the profile — an unreachable
-- page. Block the collisions at the source. Keep in sync with RESERVED_USERNAMES
-- in app/dashboard/page.tsx.
DO $$
BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_username_not_reserved
    CHECK (username IS NULL OR lower(username) NOT IN (
      'api', 'auth', 'dashboard', 'invite', 'merchant',
      'admin', 'settings', 'login', 'logout', 'signup', 'about',
      'help', 'support', 'terms', 'privacy', 'static', 'public', 'www'
    ));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_privacy_tier_check
    CHECK (privacy_tier IN ('private', 'members_only', 'public'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Case-insensitive uniqueness. NULLs are exempt, so unclaimed profiles coexist.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Public profile read path
--
-- Deliberately an RPC rather than a new anon SELECT policy on profiles:
--
--   a) The page must distinguish "no such username" (404) from "exists but
--      gated" (locked state). A row-level policy can only hide the whole row,
--      which collapses those two cases into 404.
--   b) RLS is row-level, so an anon policy permissive enough to reveal that a
--      private profile exists would also expose its bio, name and city.
--   c) The stats join hangouts / hangout_rsvps. Both currently raise
--      54001 (stack depth exceeded — recursive policy) when evaluated as anon,
--      so any anon-side join against them fails outright. SECURITY DEFINER
--      sidesteps that pre-existing issue rather than depending on it.
--
-- Visibility rules:
--   public       -> anyone, signed in or not
--   members_only -> any authenticated Knot user
--   private      -> owner only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_profile(p_username TEXT)
RETURNS TABLE (
  id                  UUID,
  username            TEXT,
  name                TEXT,
  bio                 TEXT,
  resident_city       TEXT,
  avatar_url          TEXT,
  privacy_tier        TEXT,
  hangouts_attended   INTEGER,
  hangouts_organised  INTEGER,
  is_owner            BOOLEAN,
  locked              BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  p        public.profiles%ROWTYPE;
  viewer   UUID := auth.uid();
  v_owner  BOOLEAN;
  v_visible BOOLEAN;
BEGIN
  SELECT * INTO p
  FROM public.profiles
  WHERE lower(profiles.username) = lower(p_username)
  LIMIT 1;

  -- No such username: return zero rows so the caller can 404.
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_owner := viewer IS NOT NULL AND viewer = p.id;

  v_visible := v_owner
            OR p.privacy_tier = 'public'
            OR (p.privacy_tier = 'members_only' AND viewer IS NOT NULL);

  IF NOT v_visible THEN
    -- Locked: confirm existence and tier, disclose nothing else.
    RETURN QUERY SELECT
      NULL::UUID, p.username, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT,
      p.privacy_tier, NULL::INTEGER, NULL::INTEGER, FALSE, TRUE;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    p.id,
    p.username,
    p.name,
    p.bio,
    p.resident_city,
    p.avatar_url,
    p.privacy_tier,
    -- Attended: RSVP'd yes to a hangout that has since ended. Hangouts still
    -- voting/confirmed/live are commitments, not attendance.
    (SELECT COUNT(*)::INTEGER
       FROM public.hangout_rsvps r
       JOIN public.hangouts h ON h.id = r.hangout_id
      WHERE r.user_id = p.id
        AND r.status = 'yes'
        AND h.status = 'ended'),
    -- Organised: created it, excluding ones they later cancelled.
    (SELECT COUNT(*)::INTEGER
       FROM public.hangouts h
      WHERE h.created_by = p.id
        AND h.status <> 'cancelled'),
    v_owner,
    FALSE;
END $$;

REVOKE ALL ON FUNCTION public.get_public_profile(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile(TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Username availability
--
-- Settings needs to tell a user "taken" before they submit. A plain SELECT
-- can't answer this: profiles is not anon-readable, and a signed-in user who
-- cannot see the row holding a username would be told it is free. The unique
-- index is still the real guard — this only drives the inline hint.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_username_available(p_username TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_username ~ '^[A-Za-z0-9_]{3,20}$'
     AND lower(p_username) NOT IN (
       'api', 'auth', 'dashboard', 'invite', 'merchant',
       'admin', 'settings', 'login', 'logout', 'signup', 'about',
       'help', 'support', 'terms', 'privacy', 'static', 'public', 'www'
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles
       WHERE lower(username) = lower(p_username)
         AND id IS DISTINCT FROM auth.uid()
     );
$$;

REVOKE ALL ON FUNCTION public.is_username_available(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_username_available(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. RLS
--
-- No new policies. Owners already update their own row via the existing
-- profiles UPDATE policy (app/dashboard/page.tsx saveProfile relies on it),
-- and both reads above run SECURITY DEFINER. Adding an anon SELECT policy here
-- would widen the table's exposure for no gain — see the note in section 3.
-- ---------------------------------------------------------------------------

-- Make the new columns and RPCs visible to PostgREST without waiting for the
-- schema cache to expire.
NOTIFY pgrst, 'reload schema';
