create type public.itinerary_generation_status as enum ('pending', 'completed', 'failed');

create table public.itinerary_generation_operations (
  id uuid primary key default extensions.gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  requested_by uuid not null references public.trip_members(id) on delete cascade,
  idempotency_key uuid not null,
  status public.itinerary_generation_status not null default 'pending',
  error text check (error is null or char_length(error) between 1 and 500),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (trip_id, idempotency_key),
  check ((status = 'pending' and completed_at is null) or (status <> 'pending' and completed_at is not null))
);

create table public.itinerary_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  operation_id uuid not null unique references public.itinerary_generation_operations(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  destination_option_id text not null,
  destination_locked_at timestamptz not null,
  schema_version text not null check (schema_version = '1.0'),
  content jsonb not null check (
    jsonb_typeof(content) = 'object'
    and content->>'schemaVersion' = '1.0'
    and jsonb_typeof(content->'days') = 'array'
    and jsonb_array_length(content->'days') > 0
  ),
  input_snapshot jsonb not null check (jsonb_typeof(input_snapshot) = 'object'),
  generated_at timestamptz not null default now(),
  unique (trip_id, version_number)
);

create index itinerary_versions_trip_generated_idx on public.itinerary_versions (trip_id, generated_at desc);
create index itinerary_operations_trip_created_idx on public.itinerary_generation_operations (trip_id, created_at desc);
alter table public.itinerary_generation_operations enable row level security;
alter table public.itinerary_versions enable row level security;
revoke all on public.itinerary_generation_operations, public.itinerary_versions from anon, authenticated;
grant select on public.itinerary_generation_operations, public.itinerary_versions to authenticated;
grant select, insert, update on public.itinerary_generation_operations to service_role;
grant select, insert on public.itinerary_versions to service_role;

create policy "Active members can read itinerary operations" on public.itinerary_generation_operations for select to authenticated
using ((select private.is_active_trip_member(trip_id)));
create policy "Active members can read itinerary versions" on public.itinerary_versions for select to authenticated
using ((select private.is_active_trip_member(trip_id)));

create or replace function public.get_itinerary_state(p_trip_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare caller_member public.trip_members%rowtype; latest_version public.itinerary_versions%rowtype; latest_operation public.itinerary_generation_operations%rowtype; result jsonb;
begin
  select member.* into caller_member from public.trip_members member where member.trip_id = p_trip_id and member.user_id = (select auth.uid()) and member.active;
  if caller_member.id is null then raise exception using errcode = '42501', message = 'Trip Room access is unavailable.'; end if;
  select version.* into latest_version from public.itinerary_versions version join public.trips trip on trip.id = version.trip_id
    where version.trip_id = p_trip_id and trip.destination_locked_at is not null
      and version.destination_option_id = trip.locked_destination_option_id and version.destination_locked_at = trip.destination_locked_at
    order by version.version_number desc limit 1;
  select operation.* into latest_operation from public.itinerary_generation_operations operation where operation.trip_id = p_trip_id order by operation.created_at desc limit 1;
  select jsonb_build_object(
    'tripId', trip.id, 'tripName', trip.name, 'currentRole', caller_member.role,
    'lockedDestination', case when trip.destination_locked_at is null then null else jsonb_build_object('name', trip.locked_destination_name, 'country', trip.locked_destination_country, 'lockedAt', trip.destination_locked_at) end,
    'latest', case when latest_version.id is null then null else jsonb_build_object('versionId', latest_version.id, 'version', latest_version.version_number, 'generatedAt', latest_version.generated_at, 'itinerary', latest_version.content) end,
    'operation', case when latest_operation.id is null then null else jsonb_build_object('idempotencyKey', latest_operation.idempotency_key, 'status', latest_operation.status, 'startedAt', latest_operation.created_at, 'error', latest_operation.error) end
  ) into result from public.trips trip where trip.id = p_trip_id;
  return result;
end; $$;

create or replace function public.store_generated_itinerary(
  p_operation_id uuid, p_destination_option_id text, p_destination_locked_at timestamptz,
  p_content jsonb, p_input_snapshot jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare target_operation public.itinerary_generation_operations%rowtype; target_trip public.trips%rowtype; stored public.itinerary_versions%rowtype; next_version integer;
begin
  select operation.* into target_operation from public.itinerary_generation_operations operation where operation.id = p_operation_id for update;
  if target_operation.id is null then raise exception using errcode = 'P0002', message = 'Generation operation was not found.'; end if;
  select version.* into stored from public.itinerary_versions version where version.operation_id = p_operation_id;
  if stored.id is not null then return jsonb_build_object('versionId', stored.id, 'version', stored.version_number, 'generatedAt', stored.generated_at, 'itinerary', stored.content); end if;
  select trip.* into target_trip from public.trips trip where trip.id = target_operation.trip_id for update;
  if target_trip.destination_locked_at is null or target_trip.locked_destination_option_id <> p_destination_option_id or target_trip.destination_locked_at <> p_destination_locked_at then
    raise exception using errcode = '22023', message = 'The locked destination changed during generation.';
  end if;
  select coalesce(max(version.version_number), 0) + 1 into next_version from public.itinerary_versions version where version.trip_id = target_operation.trip_id;
  insert into public.itinerary_versions (trip_id, operation_id, version_number, destination_option_id, destination_locked_at, schema_version, content, input_snapshot)
    values (target_operation.trip_id, p_operation_id, next_version, p_destination_option_id, p_destination_locked_at, '1.0', p_content, p_input_snapshot) returning * into stored;
  update public.itinerary_generation_operations set status = 'completed', error = null, completed_at = now() where id = p_operation_id;
  return jsonb_build_object('versionId', stored.id, 'version', stored.version_number, 'generatedAt', stored.generated_at, 'itinerary', stored.content);
end; $$;

revoke all on function public.get_itinerary_state(uuid) from public, anon;
grant execute on function public.get_itinerary_state(uuid) to authenticated;
revoke all on function public.store_generated_itinerary(uuid, text, timestamptz, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.store_generated_itinerary(uuid, text, timestamptz, jsonb, jsonb) to service_role;
