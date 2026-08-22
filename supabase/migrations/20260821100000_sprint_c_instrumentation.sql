-- Sprint C: Instrumentation — events + feature_flags.
--
-- Already applied to Supabase — reconstructed from the live schema
-- (information_schema, pg_constraint, pg_indexes, pg_policies) for repo
-- record keeping.

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  knot_id     uuid REFERENCES public.knots(id) ON DELETE SET NULL,
  event_name  text NOT NULL,
  properties  jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_user_idx ON public.events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS events_name_idx ON public.events (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS events_knot_idx ON public.events (knot_id, created_at DESC);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS events_select_own ON public.events;
CREATE POLICY events_select_own ON public.events
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS events_insert ON public.events;
CREATE POLICY events_insert ON public.events
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- feature_flags
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key    text NOT NULL UNIQUE,
  enabled     boolean NOT NULL DEFAULT false,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Readable by any signed-in member — flags gate client behavior, not data,
-- so there's nothing sensitive to scope per-user here. No client write path;
-- flags are flipped from the Supabase dashboard / service role.
DROP POLICY IF EXISTS feature_flags_select ON public.feature_flags;
CREATE POLICY feature_flags_select ON public.feature_flags
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.feature_flags (flag_key, enabled, description) VALUES
  ('ai_planning_agent',  false, 'Sprint F: AI hangout planning agent in composer'),
  ('group_decision_poll', false, 'Sprint E: Poll-first venue decision flow'),
  ('presence_indicator', false, 'Sprint G: Real-time presence inside Knots'),
  ('knot_trips',         false, 'Sprint 26: Knot Trips travel planning'),
  ('knot_wallet',        false, 'Sprint 23: Stored-value group wallet'),
  ('merchant_specials',  true,  'Knot Specials display on hangout cards'),
  ('receipt_ocr',        true,  'Claude vision receipt scanning in bill form'),
  ('push_notifications', true,  'Web Push notification delivery')
ON CONFLICT (flag_key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
