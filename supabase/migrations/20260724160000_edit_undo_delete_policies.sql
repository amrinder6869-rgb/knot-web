-- Sprint E: edit / undo / delete — RLS policies + hangout cancelled status
-- Idempotent: skips existing policies; safe to re-run.
-- Apply against the production (or local) Supabase project before relying on
-- client-side UPDATE/DELETE calls. Check first with:
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = '<table>';

-- ---------------------------------------------------------------------------
-- posts: author can update / delete their own rows
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'posts' AND policyname = 'posts_update_own'
  ) THEN
    CREATE POLICY posts_update_own ON public.posts
      FOR UPDATE TO authenticated
      USING (author_id = auth.uid())
      WITH CHECK (author_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'posts' AND policyname = 'posts_delete_own'
  ) THEN
    CREATE POLICY posts_delete_own ON public.posts
      FOR DELETE TO authenticated
      USING (author_id = auth.uid());
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- comments: author can update / delete their own rows
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'comments' AND policyname = 'comments_update_own'
  ) THEN
    CREATE POLICY comments_update_own ON public.comments
      FOR UPDATE TO authenticated
      USING (author_id = auth.uid())
      WITH CHECK (author_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'comments' AND policyname = 'comments_delete_own'
  ) THEN
    CREATE POLICY comments_delete_own ON public.comments
      FOR DELETE TO authenticated
      USING (author_id = auth.uid());
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- photo_comments: author column is user_id (not author_id)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'photo_comments' AND policyname = 'photo_comments_update_own'
  ) THEN
    CREATE POLICY photo_comments_update_own ON public.photo_comments
      FOR UPDATE TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'photo_comments' AND policyname = 'photo_comments_delete_own'
  ) THEN
    CREATE POLICY photo_comments_delete_own ON public.photo_comments
      FOR DELETE TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- hangouts: creator can update (covers edit + cancel). Skip if any UPDATE
-- policy already exists for this table (e.g. hangouts_update from a prior sprint).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hangouts' AND cmd = 'UPDATE'
  ) THEN
    CREATE POLICY hangouts_update_own ON public.hangouts
      FOR UPDATE TO authenticated
      USING (created_by = auth.uid())
      WITH CHECK (created_by = auth.uid());
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- hangouts.status: allow 'cancelled' (E.4)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT c.conname INTO con_name
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_namespace n ON t.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND t.relname = 'hangouts'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%status%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.hangouts DROP CONSTRAINT %I', con_name);
  END IF;

  ALTER TABLE public.hangouts
    ADD CONSTRAINT hangouts_status_check
    CHECK (status IN ('voting', 'confirmed', 'live', 'ended', 'cancelled'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- bills: added_by can update / delete (parity with Bills tab; skip if present)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bills' AND cmd = 'UPDATE'
  ) THEN
    CREATE POLICY bills_update_own ON public.bills
      FOR UPDATE TO authenticated
      USING (added_by = auth.uid())
      WITH CHECK (added_by = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bills' AND cmd = 'DELETE'
  ) THEN
    CREATE POLICY bills_delete_own ON public.bills
      FOR DELETE TO authenticated
      USING (added_by = auth.uid());
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- games: creator can delete waiting lobbies
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'games' AND cmd = 'DELETE'
  ) THEN
    CREATE POLICY games_delete_own ON public.games
      FOR DELETE TO authenticated
      USING (created_by = auth.uid());
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- photos: uploader can update / delete (needed for moment photo swap/remove)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'photos' AND cmd = 'UPDATE'
  ) THEN
    CREATE POLICY photos_update_own ON public.photos
      FOR UPDATE TO authenticated
      USING (uploaded_by = auth.uid())
      WITH CHECK (uploaded_by = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'photos' AND cmd = 'DELETE'
  ) THEN
    CREATE POLICY photos_delete_own ON public.photos
      FOR DELETE TO authenticated
      USING (uploaded_by = auth.uid());
  END IF;
END $$;
