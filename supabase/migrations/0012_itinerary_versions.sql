create type public.itinerary_revision_status as enum ('processing', 'ready', 'activated', 'failed', 'conflict');

create table public.itinerary_revision_operations (
  id uuid primary key default extensions.gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  requested_by uuid not null references public.trip_members(id) on delete cascade,
  base_version_id uuid not null references public.itinerary_versions(id) on delete restrict,
  result_version_id uuid,
  idempotency_key uuid not null,
  instruction jsonb not null check (
    jsonb_typeof(instruction) = 'object'
    and instruction->>'kind' in ('pace', 'replace_activity', 'budget_cap')
  ),
  semantic_diff jsonb,
  status public.itinerary_revision_status not null default 'processing',
  error text check (error is null or char_length(error) between 1 and 500),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (trip_id, idempotency_key)
);

alter table public.itinerary_versions alter column operation_id drop not null;
alter table public.itinerary_versions add column revision_operation_id uuid unique references public.itinerary_revision_operations(id) on delete restrict;
alter table public.itinerary_versions add constraint itinerary_version_has_one_source check (num_nonnulls(operation_id, revision_operation_id) = 1);
alter table public.itinerary_revision_operations add constraint itinerary_revision_result_fk foreign key (result_version_id) references public.itinerary_versions(id) on delete restrict;
alter table public.trips add column active_itinerary_version_id uuid references public.itinerary_versions(id) on delete restrict;

update public.trips trip set active_itinerary_version_id = (
  select version.id from public.itinerary_versions version
  where version.trip_id = trip.id order by version.version_number desc limit 1
);

create index itinerary_revision_trip_created_idx on public.itinerary_revision_operations (trip_id, created_at desc);
alter table public.itinerary_revision_operations enable row level security;
revoke all on public.itinerary_revision_operations from anon, authenticated;
grant select on public.itinerary_revision_operations to authenticated;
grant select, insert, update on public.itinerary_revision_operations to service_role;
create policy "Active members can read itinerary revisions" on public.itinerary_revision_operations for select to authenticated
using ((select private.is_active_trip_member(trip_id)));

create or replace function public.begin_itinerary_revision(
  p_trip_id uuid, p_base_version_id uuid, p_idempotency_key uuid, p_instruction jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare caller_member public.trip_members%rowtype; target_trip public.trips%rowtype; base_version public.itinerary_versions%rowtype; existing public.itinerary_revision_operations%rowtype; operation_id uuid;
begin
  select member.* into caller_member from public.trip_members member
    where member.trip_id = p_trip_id and member.user_id = (select auth.uid()) and member.active;
  if caller_member.id is null then raise exception using errcode = '42501', message = 'Trip Room access is unavailable.'; end if;
  if caller_member.role <> 'organizer' then raise exception using errcode = '42501', message = 'Only the organiser can revise the itinerary.'; end if;
  if jsonb_typeof(p_instruction) <> 'object' or p_instruction->>'kind' not in ('pace', 'replace_activity', 'budget_cap') then
    raise exception using errcode = '22023', message = 'Revision instruction is invalid.';
  end if;
  select operation.* into existing from public.itinerary_revision_operations operation
    where operation.trip_id = p_trip_id and operation.idempotency_key = p_idempotency_key;
  if existing.id is not null then
    if existing.base_version_id <> p_base_version_id or existing.instruction <> p_instruction then raise exception using errcode = '22023', message = 'Idempotency key was already used for a different revision.'; end if;
    select version.* into base_version from public.itinerary_versions version where version.id = existing.base_version_id;
    return jsonb_build_object('operationId', existing.id, 'status', existing.status, 'base', jsonb_build_object('versionId', base_version.id, 'version', base_version.version_number, 'generatedAt', base_version.generated_at, 'itinerary', base_version.content));
  end if;
  select trip.* into target_trip from public.trips trip where trip.id = p_trip_id for update;
  if target_trip.active_itinerary_version_id is null or target_trip.active_itinerary_version_id <> p_base_version_id then
    raise exception using errcode = 'P0003', message = 'VERSION_CONFLICT';
  end if;
  if exists (select 1 from public.itinerary_revision_operations operation where operation.trip_id = p_trip_id and operation.base_version_id = p_base_version_id and operation.status in ('processing', 'ready')) then
    raise exception using errcode = 'P0003', message = 'VERSION_CONFLICT';
  end if;
  select version.* into base_version from public.itinerary_versions version where version.id = p_base_version_id and version.trip_id = p_trip_id;
  if base_version.id is null then raise exception using errcode = 'P0002', message = 'Base itinerary version was not found.'; end if;
  insert into public.itinerary_revision_operations (trip_id, requested_by, base_version_id, idempotency_key, instruction)
    values (p_trip_id, caller_member.id, p_base_version_id, p_idempotency_key, p_instruction) returning id into operation_id;
  return jsonb_build_object('operationId', operation_id, 'status', 'processing', 'base', jsonb_build_object('versionId', base_version.id, 'version', base_version.version_number, 'generatedAt', base_version.generated_at, 'itinerary', base_version.content));
end; $$;

create or replace function public.store_revised_itinerary(p_operation_id uuid, p_content jsonb, p_semantic_diff jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare operation public.itinerary_revision_operations%rowtype; target_trip public.trips%rowtype; base_version public.itinerary_versions%rowtype; stored public.itinerary_versions%rowtype; next_version integer;
begin
  select item.* into operation from public.itinerary_revision_operations item where item.id = p_operation_id for update;
  if operation.id is null then raise exception using errcode = 'P0002', message = 'Revision operation was not found.'; end if;
  if operation.result_version_id is not null then select version.* into stored from public.itinerary_versions version where version.id = operation.result_version_id; return jsonb_build_object('versionId', stored.id, 'version', stored.version_number, 'generatedAt', stored.generated_at, 'itinerary', stored.content); end if;
  select trip.* into target_trip from public.trips trip where trip.id = operation.trip_id for update;
  if target_trip.active_itinerary_version_id <> operation.base_version_id then
    update public.itinerary_revision_operations set status = 'conflict', error = 'VERSION_CONFLICT', completed_at = now() where id = operation.id;
    raise exception using errcode = 'P0003', message = 'VERSION_CONFLICT';
  end if;
  select version.* into base_version from public.itinerary_versions version where version.id = operation.base_version_id;
  select coalesce(max(version.version_number), 0) + 1 into next_version from public.itinerary_versions version where version.trip_id = operation.trip_id;
  insert into public.itinerary_versions (trip_id, revision_operation_id, version_number, destination_option_id, destination_locked_at, schema_version, content, input_snapshot)
    values (operation.trip_id, operation.id, next_version, base_version.destination_option_id, base_version.destination_locked_at, '1.0', p_content,
      jsonb_build_object('revisionOf', operation.base_version_id, 'instruction', operation.instruction)) returning * into stored;
  update public.itinerary_revision_operations set result_version_id = stored.id, semantic_diff = p_semantic_diff, status = 'ready', error = null, completed_at = now() where id = operation.id;
  return jsonb_build_object('versionId', stored.id, 'version', stored.version_number, 'generatedAt', stored.generated_at, 'itinerary', stored.content);
end; $$;

create or replace function public.activate_itinerary_version(p_trip_id uuid, p_version_id uuid, p_expected_active_version_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare caller_member public.trip_members%rowtype; target_trip public.trips%rowtype; target_version public.itinerary_versions%rowtype;
begin
  select member.* into caller_member from public.trip_members member where member.trip_id = p_trip_id and member.user_id = (select auth.uid()) and member.active;
  if caller_member.id is null then raise exception using errcode = '42501', message = 'Trip Room access is unavailable.'; end if;
  if caller_member.role <> 'organizer' then raise exception using errcode = '42501', message = 'Only the organiser can activate itinerary versions.'; end if;
  select trip.* into target_trip from public.trips trip where trip.id = p_trip_id for update;
  if target_trip.active_itinerary_version_id <> p_expected_active_version_id then raise exception using errcode = 'P0003', message = 'VERSION_CONFLICT'; end if;
  select version.* into target_version from public.itinerary_versions version where version.id = p_version_id and version.trip_id = p_trip_id;
  if target_version.id is null then raise exception using errcode = 'P0002', message = 'Itinerary version was not found.'; end if;
  if target_version.revision_operation_id is not null and not exists (select 1 from public.itinerary_revision_operations operation where operation.id = target_version.revision_operation_id and operation.status in ('ready', 'activated')) then
    raise exception using errcode = '55000', message = 'Revision is not ready for activation.';
  end if;
  update public.trips set active_itinerary_version_id = p_version_id, updated_at = now() where id = p_trip_id;
  update public.itinerary_revision_operations set status = 'activated' where id = target_version.revision_operation_id and status = 'ready';
  return jsonb_build_object('tripId', p_trip_id, 'activeVersionId', p_version_id);
end; $$;

create or replace function public.get_itinerary_revision_state(p_trip_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare caller_member public.trip_members%rowtype; target_trip public.trips%rowtype; active_version public.itinerary_versions%rowtype; pending_operation public.itinerary_revision_operations%rowtype; pending_version public.itinerary_versions%rowtype; history jsonb;
begin
  select member.* into caller_member from public.trip_members member where member.trip_id = p_trip_id and member.user_id = (select auth.uid()) and member.active;
  if caller_member.id is null then raise exception using errcode = '42501', message = 'Trip Room access is unavailable.'; end if;
  select trip.* into target_trip from public.trips trip where trip.id = p_trip_id;
  select version.* into active_version from public.itinerary_versions version where version.id = target_trip.active_itinerary_version_id;
  select operation.* into pending_operation from public.itinerary_revision_operations operation where operation.trip_id = p_trip_id and operation.status = 'ready' order by operation.created_at desc limit 1;
  if pending_operation.id is not null then select version.* into pending_version from public.itinerary_versions version where version.id = pending_operation.result_version_id; end if;
  select coalesce(jsonb_agg(jsonb_build_object('versionId', version.id, 'version', version.version_number, 'generatedAt', version.generated_at, 'active', version.id = target_trip.active_itinerary_version_id, 'instruction', operation.instruction) order by version.version_number desc), '[]'::jsonb)
    into history from public.itinerary_versions version left join public.itinerary_revision_operations operation on operation.id = version.revision_operation_id where version.trip_id = p_trip_id;
  return jsonb_build_object(
    'tripId', target_trip.id, 'tripName', target_trip.name, 'currentRole', caller_member.role,
    'active', case when active_version.id is null then null else jsonb_build_object('versionId', active_version.id, 'version', active_version.version_number, 'generatedAt', active_version.generated_at, 'itinerary', active_version.content) end,
    'history', history,
    'pending', case when pending_operation.id is null then null else jsonb_build_object('revisionId', pending_operation.id, 'baseVersionId', pending_operation.base_version_id, 'status', pending_operation.status, 'instruction', pending_operation.instruction, 'candidate', jsonb_build_object('versionId', pending_version.id, 'version', pending_version.version_number, 'generatedAt', pending_version.generated_at, 'itinerary', pending_version.content), 'diff', pending_operation.semantic_diff) end
  );
end; $$;

create or replace function public.get_itinerary_state(p_trip_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare caller_member public.trip_members%rowtype; latest_version public.itinerary_versions%rowtype; latest_operation public.itinerary_generation_operations%rowtype; result jsonb;
begin
  select member.* into caller_member from public.trip_members member where member.trip_id = p_trip_id and member.user_id = (select auth.uid()) and member.active;
  if caller_member.id is null then raise exception using errcode = '42501', message = 'Trip Room access is unavailable.'; end if;
  select version.* into latest_version from public.itinerary_versions version join public.trips trip on trip.active_itinerary_version_id = version.id where trip.id = p_trip_id;
  select operation.* into latest_operation from public.itinerary_generation_operations operation where operation.trip_id = p_trip_id order by operation.created_at desc limit 1;
  select jsonb_build_object('tripId', trip.id, 'tripName', trip.name, 'currentRole', caller_member.role,
    'lockedDestination', case when trip.destination_locked_at is null then null else jsonb_build_object('name', trip.locked_destination_name, 'country', trip.locked_destination_country, 'lockedAt', trip.destination_locked_at) end,
    'latest', case when latest_version.id is null then null else jsonb_build_object('versionId', latest_version.id, 'version', latest_version.version_number, 'generatedAt', latest_version.generated_at, 'itinerary', latest_version.content) end,
    'operation', case when latest_operation.id is null then null else jsonb_build_object('idempotencyKey', latest_operation.idempotency_key, 'status', latest_operation.status, 'startedAt', latest_operation.created_at, 'error', latest_operation.error) end)
    into result from public.trips trip where trip.id = p_trip_id;
  return result;
end; $$;

create or replace function public.store_generated_itinerary(p_operation_id uuid, p_destination_option_id text, p_destination_locked_at timestamptz, p_content jsonb, p_input_snapshot jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target_operation public.itinerary_generation_operations%rowtype; target_trip public.trips%rowtype; stored public.itinerary_versions%rowtype; next_version integer;
begin
  select operation.* into target_operation from public.itinerary_generation_operations operation where operation.id = p_operation_id for update;
  if target_operation.id is null then raise exception using errcode = 'P0002', message = 'Generation operation was not found.'; end if;
  select version.* into stored from public.itinerary_versions version where version.operation_id = p_operation_id;
  if stored.id is not null then return jsonb_build_object('versionId', stored.id, 'version', stored.version_number, 'generatedAt', stored.generated_at, 'itinerary', stored.content); end if;
  select trip.* into target_trip from public.trips trip where trip.id = target_operation.trip_id for update;
  if target_trip.destination_locked_at is null or target_trip.locked_destination_option_id <> p_destination_option_id or target_trip.destination_locked_at <> p_destination_locked_at then raise exception using errcode = '22023', message = 'The locked destination changed during generation.'; end if;
  select coalesce(max(version.version_number), 0) + 1 into next_version from public.itinerary_versions version where version.trip_id = target_operation.trip_id;
  insert into public.itinerary_versions (trip_id, operation_id, version_number, destination_option_id, destination_locked_at, schema_version, content, input_snapshot)
    values (target_operation.trip_id, p_operation_id, next_version, p_destination_option_id, p_destination_locked_at, '1.0', p_content, p_input_snapshot) returning * into stored;
  update public.itinerary_generation_operations set status = 'completed', error = null, completed_at = now() where id = p_operation_id;
  if target_trip.active_itinerary_version_id is null then update public.trips set active_itinerary_version_id = stored.id where id = target_trip.id; end if;
  return jsonb_build_object('versionId', stored.id, 'version', stored.version_number, 'generatedAt', stored.generated_at, 'itinerary', stored.content);
end; $$;

revoke all on function public.begin_itinerary_revision(uuid,uuid,uuid,jsonb) from public, anon;
grant execute on function public.begin_itinerary_revision(uuid,uuid,uuid,jsonb) to authenticated;
revoke all on function public.store_revised_itinerary(uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.store_revised_itinerary(uuid,jsonb,jsonb) to service_role;
revoke all on function public.activate_itinerary_version(uuid,uuid,uuid) from public, anon;
grant execute on function public.activate_itinerary_version(uuid,uuid,uuid) to authenticated;
revoke all on function public.get_itinerary_revision_state(uuid) from public, anon;
grant execute on function public.get_itinerary_revision_state(uuid) to authenticated;
