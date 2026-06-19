-- Local development schema for the "Knot" app, reverse-engineered from the
-- Supabase queries in app/ and components/. Intended for local Supabase only.
-- RLS is left disabled and broad privileges are granted to the anon/authenticated
-- roles so the app is fully usable in local development without per-table policies.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text,
  budget_tier text default 'mid',
  avatar_url  text,
  created_at  timestamptz not null default now()
);

create table if not exists public.knots (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  emoji      text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.knot_members (
  id        uuid primary key default gen_random_uuid(),
  knot_id   uuid not null references public.knots(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      text default 'member',
  joined_at timestamptz not null default now(),
  unique (knot_id, user_id)
);

create table if not exists public.invites (
  id         uuid primary key default gen_random_uuid(),
  knot_id    uuid not null references public.knots(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  token      uuid not null default gen_random_uuid(),
  expires_at timestamptz not null default (now() + interval '48 hours'),
  used_by    uuid references auth.users(id) on delete set null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.nominations (
  id             uuid primary key default gen_random_uuid(),
  knot_id        uuid not null references public.knots(id) on delete cascade,
  nominee_name   text not null,
  nominee_email  text,
  nominator_note text,
  status         text default 'pending',
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);

create table if not exists public.nomination_votes (
  id            uuid primary key default gen_random_uuid(),
  nomination_id uuid not null references public.nominations(id) on delete cascade,
  voter_id      uuid not null references auth.users(id) on delete cascade,
  vote          text,
  anon_note     text,
  created_at    timestamptz not null default now(),
  unique (nomination_id, voter_id)
);

create table if not exists public.hangouts (
  id                uuid primary key default gen_random_uuid(),
  knot_id           uuid not null references public.knots(id) on delete cascade,
  created_by        uuid references auth.users(id) on delete set null,
  status            text default 'voting',
  title             text,
  budget_sweet_spot text,
  created_at        timestamptz not null default now()
);

create table if not exists public.hangout_options (
  id         uuid primary key default gen_random_uuid(),
  hangout_id uuid not null references public.hangouts(id) on delete cascade,
  label      text not null,
  emoji      text,
  vote_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.hangout_votes (
  id         uuid primary key default gen_random_uuid(),
  hangout_id uuid not null references public.hangouts(id) on delete cascade,
  option_id  uuid not null references public.hangout_options(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (hangout_id, user_id)
);

create table if not exists public.posts (
  id         uuid primary key default gen_random_uuid(),
  knot_id    uuid not null references public.knots(id) on delete cascade,
  author_id  uuid references auth.users(id) on delete set null,
  content    text,
  post_type  text default 'moment',
  created_at timestamptz not null default now()
);

create table if not exists public.reactions (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  emoji      text not null,
  created_at timestamptz not null default now(),
  unique (post_id, user_id, emoji)
);

create table if not exists public.bills (
  id           uuid primary key default gen_random_uuid(),
  knot_id      uuid not null references public.knots(id) on delete cascade,
  added_by     uuid references auth.users(id) on delete set null,
  total_amount numeric not null,
  description  text,
  split_type   text default 'equal',
  created_at   timestamptz not null default now()
);

create table if not exists public.bill_splits (
  id         uuid primary key default gen_random_uuid(),
  bill_id    uuid not null references public.bills(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,
  amount     numeric not null default 0,
  is_treat   boolean not null default false,
  settled    boolean not null default false,
  settled_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.photos (
  id           uuid primary key default gen_random_uuid(),
  knot_id      uuid not null references public.knots(id) on delete cascade,
  hangout_id   uuid references public.hangouts(id) on delete set null,
  uploaded_by  uuid references auth.users(id) on delete set null,
  storage_path text not null,
  file_name    text,
  file_size    bigint,
  created_at   timestamptz not null default now()
);

create table if not exists public.games (
  id         uuid primary key default gen_random_uuid(),
  knot_id    uuid not null references public.knots(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  game_type  text not null,
  status     text default 'waiting',
  data       jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.game_players (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references public.games(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  color      text,
  created_at timestamptz not null default now()
);

create table if not exists public.game_moves (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references public.games(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,
  move_data  jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Auto-create a profile row whenever a new auth user signs up.
-- The signup form passes the display name via user metadata { name }.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Storage bucket for Memories / avatars (public read).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('knot-photos', 'knot-photos', true)
on conflict (id) do nothing;

drop policy if exists "knot-photos read" on storage.objects;
create policy "knot-photos read" on storage.objects
  for select using (bucket_id = 'knot-photos');

drop policy if exists "knot-photos write" on storage.objects;
create policy "knot-photos write" on storage.objects
  for insert to authenticated with check (bucket_id = 'knot-photos');

drop policy if exists "knot-photos update" on storage.objects;
create policy "knot-photos update" on storage.objects
  for update to authenticated using (bucket_id = 'knot-photos');

drop policy if exists "knot-photos delete" on storage.objects;
create policy "knot-photos delete" on storage.objects
  for delete to authenticated using (bucket_id = 'knot-photos');

-- ---------------------------------------------------------------------------
-- Privileges: local dev convenience. RLS stays disabled on these tables, so
-- access is governed purely by these grants.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: the Feed and Games components subscribe to these tables.
-- ---------------------------------------------------------------------------

do $$
begin
  begin alter publication supabase_realtime add table public.posts; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.games; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.game_players; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.game_moves; exception when duplicate_object then null; end;
end$$;
