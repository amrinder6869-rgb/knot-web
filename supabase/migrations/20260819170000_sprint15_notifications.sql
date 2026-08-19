-- Sprint 15: in-app notification center.
--
-- Already applied to Supabase — reconstructed from the live schema
-- (information_schema, pg_policies, pg_publication_tables) for repo record
-- keeping. No new DDL in this sprint: the notifications table, its RLS
-- policies, and its realtime publication membership already cover every
-- capability this sprint's frontend work needed (limit 50, link_url
-- navigation, new notification types are free-text so no CHECK constraint
-- to widen).

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  knot_id     uuid REFERENCES public.knots(id) ON DELETE CASCADE,
  type        text NOT NULL,
  actor_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  entity_id   uuid,
  message     text NOT NULL,
  link_url    text,
  read        boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Duplicated policy names as originally applied (two SELECT + two UPDATE
-- policies covering the same predicate) — harmless, left as-is rather than
-- consolidated, since this file mirrors what's live rather than prescribing
-- a cleanup.
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
CREATE POLICY "Users can read own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_select ON public.notifications;
CREATE POLICY notifications_select ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_update ON public.notifications;
CREATE POLICY notifications_update ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Intentionally permissive: any authenticated user can insert a notification
-- row for any user_id. This is required for the existing broadcast pattern
-- (notifyKnotMembers inserting on behalf of every other knot member, and now
-- createNotification inserting single-recipient rows for the requesting
-- user's counterpart) where the actor and the recipient are different users.
DROP POLICY IF EXISTS notifications_insert ON public.notifications;
CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- notifications is already in the supabase_realtime publication — both
-- Notifications.tsx's unread-count subscription and the topbar bell rely on
-- this with no publication changes needed.

NOTIFY pgrst, 'reload schema';
