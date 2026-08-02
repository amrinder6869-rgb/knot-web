-- Comment reactions for post + hangout comments
-- Idempotent: safe to re-run on fresh envs.

CREATE TABLE IF NOT EXISTS public.comment_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS comment_reactions_comment_id_idx
  ON public.comment_reactions (comment_id);

ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'comment_reactions' AND policyname = 'comment_reactions_select'
  ) THEN
    CREATE POLICY comment_reactions_select ON public.comment_reactions
      FOR SELECT TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'comment_reactions' AND policyname = 'comment_reactions_insert_own'
  ) THEN
    CREATE POLICY comment_reactions_insert_own ON public.comment_reactions
      FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'comment_reactions' AND policyname = 'comment_reactions_delete_own'
  ) THEN
    CREATE POLICY comment_reactions_delete_own ON public.comment_reactions
      FOR DELETE TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;
