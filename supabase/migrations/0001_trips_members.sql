create extension if not exists pgcrypto with schema extensions;

create type public.planning_mode as enum (
  'destination_locked',
  'shortlist',
  'undecided'
);

create type public.trip_status as enum ('draft');
create type public.trip_member_role as enum ('organizer', 'member');

create table public.trips (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  mode public.planning_mode not null,
  status public.trip_status not null default 'draft',
  organizer_member_id uuid,
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_trip_dates check (starts_on is null or ends_on is null or ends_on >= starts_on)
);

create table public.trip_members (
  id uuid primary key default extensions.gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 50),
  role public.trip_member_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (trip_id, user_id)
);

alter table public.trips
  add constraint trips_organizer_member_fk
  foreign key (organizer_member_id)
  references public.trip_members(id)
  on delete restrict;

create unique index one_active_organizer_per_trip
  on public.trip_members (trip_id)
  where role = 'organizer' and active;

create table public.trip_destinations (
  id uuid primary key default extensions.gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  sort_order smallint not null check (sort_order between 1 and 5),
  source text not null default 'manual' check (source = 'manual'),
  created_at timestamptz not null default now(),
  unique (trip_id, sort_order)
);

create unique index unique_destination_name_per_trip
  on public.trip_destinations (trip_id, lower(name));

create table public.request_idempotency (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation text not null,
  idempotency_key uuid not null,
  response jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, operation, idempotency_key)
);

alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_destinations enable row level security;
alter table public.request_idempotency enable row level security;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_active_trip_member(target_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trip_members member
    where member.trip_id = target_trip_id
      and member.user_id = (select auth.uid())
      and member.active
  );
$$;

revoke all on function private.is_active_trip_member(uuid) from public;
grant execute on function private.is_active_trip_member(uuid) to authenticated;

create policy "Active members can read their trips"
  on public.trips
  for select
  to authenticated
  using ((select private.is_active_trip_member(id)));

create policy "Active members can read room membership"
  on public.trip_members
  for select
  to authenticated
  using ((select private.is_active_trip_member(trip_id)));

create policy "Active members can read trip destinations"
  on public.trip_destinations
  for select
  to authenticated
  using ((select private.is_active_trip_member(trip_id)));

revoke all on public.trips from anon, authenticated;
revoke all on public.trip_members from anon, authenticated;
revoke all on public.trip_destinations from anon, authenticated;
revoke all on public.request_idempotency from anon, authenticated;
grant select on public.trips to authenticated;
grant select on public.trip_members to authenticated;
grant select on public.trip_destinations to authenticated;

create or replace function public.create_trip(
  p_name text,
  p_mode public.planning_mode,
  p_destinations text[],
  p_starts_on date,
  p_ends_on date,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  normalized_destinations text[];
  destination_count integer;
  unique_destination_count integer;
  existing_response jsonb;
  inserted_count integer;
  new_trip_id uuid;
  new_member_id uuid;
  result jsonb;
begin
  if caller_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required.';
  end if;

  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 80 then
    raise exception using errcode = '22023', message = 'Trip name must have 2 to 80 characters.';
  end if;

  if p_starts_on is not null and p_ends_on is not null and p_ends_on < p_starts_on then
    raise exception using errcode = '22023', message = 'End date cannot be before the start date.';
  end if;

  select coalesce(array_agg(btrim(item) order by ordinal), '{}'::text[])
  into normalized_destinations
  from unnest(coalesce(p_destinations, '{}'::text[])) with ordinality as input(item, ordinal)
  where btrim(item) <> '';

  destination_count := cardinality(normalized_destinations);
  select count(distinct lower(item)) into unique_destination_count
  from unnest(normalized_destinations) as item;

  if destination_count <> unique_destination_count then
    raise exception using errcode = '22023', message = 'Destinations must be unique.';
  end if;

  if p_mode = 'destination_locked' and destination_count <> 1 then
    raise exception using errcode = '22023', message = 'Locked destination mode requires one destination.';
  elsif p_mode = 'shortlist' and destination_count not between 2 and 5 then
    raise exception using errcode = '22023', message = 'Shortlist mode requires 2 to 5 destinations.';
  elsif p_mode = 'undecided' and destination_count <> 0 then
    raise exception using errcode = '22023', message = 'Undecided mode cannot include destinations.';
  end if;

  select request.response
  into existing_response
  from public.request_idempotency request
  where request.user_id = caller_id
    and request.operation = 'create_trip'
    and request.idempotency_key = p_idempotency_key;

  if found and existing_response is not null then
    return existing_response;
  end if;

  insert into public.request_idempotency (user_id, operation, idempotency_key)
  values (caller_id, 'create_trip', p_idempotency_key)
  on conflict do nothing;
  get diagnostics inserted_count = row_count;

  if inserted_count = 0 then
    select request.response
    into existing_response
    from public.request_idempotency request
    where request.user_id = caller_id
      and request.operation = 'create_trip'
      and request.idempotency_key = p_idempotency_key
    for update;

    if existing_response is not null then
      return existing_response;
    end if;
    raise exception using errcode = '40001', message = 'A matching request is still being processed.';
  end if;

  insert into public.trips (name, mode, starts_on, ends_on)
  values (btrim(p_name), p_mode, p_starts_on, p_ends_on)
  returning id into new_trip_id;

  insert into public.trip_members (trip_id, user_id, display_name, role)
  values (new_trip_id, caller_id, 'Organiser', 'organizer')
  returning id into new_member_id;

  update public.trips
  set organizer_member_id = new_member_id
  where id = new_trip_id;

  insert into public.trip_destinations (trip_id, name, sort_order)
  select new_trip_id, item, ordinal::smallint
  from unnest(normalized_destinations) with ordinality as destinations(item, ordinal);

  result := jsonb_build_object(
    'tripId', new_trip_id,
    'memberId', new_member_id,
    'tripName', btrim(p_name),
    'mode', p_mode,
    'status', 'draft',
    'destinations', to_jsonb(normalized_destinations),
    'startsOn', p_starts_on,
    'endsOn', p_ends_on
  );

  update public.request_idempotency
  set response = result
  where user_id = caller_id
    and operation = 'create_trip'
    and idempotency_key = p_idempotency_key;

  return result;
end;
$$;

revoke all on function public.create_trip(text, public.planning_mode, text[], date, date, uuid) from public;
grant execute on function public.create_trip(text, public.planning_mode, text[], date, date, uuid) to authenticated;
