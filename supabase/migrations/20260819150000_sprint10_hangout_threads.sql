-- Sprint 10: hangout-scoped direct threads.
--
-- Sections 1-2 are already applied to Supabase — reconstructed from the live
-- schema (information_schema, pg_constraint, pg_policies) for repo record
-- keeping.
--
-- Section 3 is NEW, drafted here but NOT yet applied — required for the
-- thread's Realtime subscription to actually receive events.

-- ---------------------------------------------------------------------------
-- 1. hangout_messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hangout_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hangout_id  uuid NOT NULL REFERENCES public.hangouts(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content     text,
  photo_path  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  edited_at   timestamptz
);

DO $$
BEGIN
  ALTER TABLE public.hangout_messages
    ADD CONSTRAINT hangout_messages_has_content
    CHECK (content IS NOT NULL OR photo_path IS NOT NULL);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.hangout_messages ENABLE ROW LEVEL SECURITY;

-- Visible to knot members for ordinary hangouts, and additionally to anyone
-- on that hangout's invite list — covers Sprint 8 selected/surprise invites.
DROP POLICY IF EXISTS hangout_messages_select ON public.hangout_messages;
CREATE POLICY hangout_messages_select ON public.hangout_messages
  FOR SELECT TO authenticated USING (
    is_knot_member((SELECT knot_id FROM hangouts WHERE id = hangout_messages.hangout_id LIMIT 1))
    OR EXISTS (SELECT 1 FROM hangout_invites WHERE hangout_id = hangout_messages.hangout_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS hangout_messages_insert ON public.hangout_messages;
CREATE POLICY hangout_messages_insert ON public.hangout_messages
  FOR INSERT TO authenticated WITH CHECK (
    author_id = auth.uid()
    AND (
      is_knot_member((SELECT knot_id FROM hangouts WHERE id = hangout_messages.hangout_id LIMIT 1))
      OR EXISTS (SELECT 1 FROM hangout_invites WHERE hangout_id = hangout_messages.hangout_id AND user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS hangout_messages_update ON public.hangout_messages;
CREATE POLICY hangout_messages_update ON public.hangout_messages
  FOR UPDATE TO authenticated USING (author_id = auth.uid());

DROP POLICY IF EXISTS hangout_messages_delete ON public.hangout_messages;
CREATE POLICY hangout_messages_delete ON public.hangout_messages
  FOR DELETE TO authenticated USING (author_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. hangout_message_reads — per-user unread tracking
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hangout_message_reads (
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  hangout_id    uuid NOT NULL REFERENCES public.hangouts(id) ON DELETE CASCADE,
  last_read_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, hangout_id)
);

ALTER TABLE public.hangout_message_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hangout_message_reads_all ON public.hangout_message_reads;
CREATE POLICY hangout_message_reads_all ON public.hangout_message_reads
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. NEW — not yet applied. Required for HangoutThread's Realtime subscription.
--
-- postgres_changes only broadcasts for tables added to the supabase_realtime
-- publication. hangout_messages was created without being added to it, so
-- .channel(...).on('postgres_changes', { table: 'hangout_messages' }, ...)
-- currently receives nothing — messages only ever show up on next manual
-- reload, never live.
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.hangout_messages;

NOTIFY pgrst, 'reload schema';
