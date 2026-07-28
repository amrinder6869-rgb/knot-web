-- Sprint 1 migration
-- Adds venue_lat and venue_lng to hangouts table
-- Powers Lyft and Uber deep links on the confirmed and live hangout card

alter table hangouts
  add column if not exists venue_lat  double precision,
  add column if not exists venue_lng  double precision;
