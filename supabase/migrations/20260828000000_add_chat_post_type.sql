-- ---------------------------------------------------------------------------
-- KnotGroupChat — posts.post_type: 'chat'.
--
-- The live valid_post_type check constraint had drifted from what's tracked
-- in this migrations folder (it currently reads ['moment','hangout','bill',
-- 'poll','game','memory'], not the ['moment','hangout','bill','system',
-- 'treat','settled','poll'] from 20260819160000_sprint11_availability_polls.sql
-- — some out-of-band migration widened/narrowed it since). This widens it to
-- add 'chat', which KnotGroupChat inserts for group-chat messages; nothing
-- existing is removed.
-- ---------------------------------------------------------------------------
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS valid_post_type;
ALTER TABLE public.posts ADD CONSTRAINT valid_post_type
  CHECK (post_type = ANY (ARRAY['moment', 'hangout', 'bill', 'poll', 'game', 'memory', 'chat']));
