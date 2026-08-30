-- ---------------------------------------------------------------------------
-- Discover — "Save for later" action on venue cards.
--
-- NOT YET APPLIED to the live database — Claude was asked to write this file
-- for tracking but not run it. Apply manually (e.g. via the Supabase SQL
-- editor or `supabase db push`) before the save/unsave button in
-- components/Discover.tsx will work; until then saveVenue()'s insert/delete
-- calls fail silently (RLS/relation errors are caught and shown as a toast,
-- and the saved-ids fetch on mount just leaves the set empty).
-- ---------------------------------------------------------------------------

CREATE TABLE public.saved_venues (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knot_id          uuid NOT NULL REFERENCES public.knots(id) ON DELETE CASCADE,
  saved_by         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  venue_place_id   text NOT NULL,
  venue_name       text NOT NULL,
  venue_address    text,
  venue_lat        double precision,
  venue_lng        double precision,
  venue_photo_url  text,
  venue_rating     numeric,
  venue_price      integer,
  venue_category   text,
  venue_maps_url   text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (knot_id, venue_place_id)
);

ALTER TABLE public.saved_venues ENABLE ROW LEVEL SECURITY;

-- Any member of the Knot can see what the group has saved.
CREATE POLICY saved_venues_select ON public.saved_venues
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.knot_members
      WHERE knot_id = saved_venues.knot_id AND user_id = auth.uid()
    )
  );

-- Any member can save a venue on the Knot's behalf, but only as themselves.
CREATE POLICY saved_venues_insert ON public.saved_venues
  FOR INSERT TO authenticated
  WITH CHECK (
    saved_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.knot_members
      WHERE knot_id = saved_venues.knot_id AND user_id = auth.uid()
    )
  );

-- Any member can unsave — matches the toggle behaviour in the bookmark
-- button, not just the original saver.
CREATE POLICY saved_venues_delete ON public.saved_venues
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.knot_members
      WHERE knot_id = saved_venues.knot_id AND user_id = auth.uid()
    )
  );
