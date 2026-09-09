alter table public.itinerary_generation_operations add column lease uuid;
alter table public.itinerary_generation_operations add column lease_started_at timestamptz;
-- Separate viewing from organiser-only preparation and lease generation attempts.
create or replace function public.prepare_quest_itinerary(p_trip_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare quest public.trip_quests%rowtype; room jsonb; country_name text; option_id text;
begin
  if not private.is_active_trip_member(p_trip_id) then
    raise exception using errcode = '42501', message = 'Trip Room access is unavailable.';
  end if;
  if not exists (select 1 from public.trip_members where trip_id = p_trip_id and user_id = (select auth.uid()) and active and role = 'organizer') then
    raise exception using errcode = '42501', message = 'Only the organiser can prepare an itinerary.';
  end if;
  perform 1 from public.trips where id = p_trip_id for update;
  select * into quest from public.trip_quests where trip_id = p_trip_id;
  if not found then return null; end if;
  if quest.stage <> 'complete' then
    raise exception using errcode = '22023', message = 'Complete the planning stages and everyone’s budget before generating an itinerary.';
  end if;
  room := public.get_trip_quest(p_trip_id);
  if room->'budgetSummary' = 'null'::jsonb or quest.period is null or cardinality(quest.attraction_ids) = 0 then
    raise exception using errcode = '22023', message = 'The completed plan is missing dates, selected places or the group budget.';
  end if;
  country_name := '{"MY":"Malaysia","TH":"Thailand","ID":"Indonesia","VN":"Vietnam","JP":"Japan","KR":"South Korea","SG":"Singapore","TW":"Taiwan","PH":"Philippines","KH":"Cambodia","LA":"Laos","IN":"India","LK":"Sri Lanka","NP":"Nepal","AU":"Australia","NZ":"New Zealand","GB":"United Kingdom","FR":"France","IT":"Italy","ES":"Spain","TR":"Türkiye","AE":"United Arab Emirates","US":"United States","CA":"Canada"}'::jsonb->>quest.selected_country_code;
  if country_name is null then raise exception 'The selected country is unavailable.'; end if;
  option_id := 'quest:' || quest.selected_country_code || ':' || quest.revision;
  update public.trips set locked_destination_option_id = option_id,
    locked_destination_name = country_name, locked_destination_country = country_name,
    destination_locked_at = quest.updated_at, starts_on = (quest.period->>'startsOn')::date,
    ends_on = (quest.period->>'endsOn')::date, planning_phase = 'itinerary_planning', active_itinerary_version_id = null, updated_at = now()
    where id = p_trip_id and locked_destination_option_id is distinct from option_id;
  return jsonb_build_object('room', room, 'updatedAt', quest.updated_at);
end; $$;

create or replace function public.get_planning_itinerary_state(p_trip_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare quest public.trip_quests%rowtype; result jsonb; country_name text; option_id text;
begin
  -- Viewing must never prepare a destination, clear a version or change a generation.
  result := public.get_itinerary_state(p_trip_id);
  result := jsonb_set(result, '{operation}', coalesce((select jsonb_build_object(
    'idempotencyKey', idempotency_key, 'status', status, 'startedAt', coalesce(lease_started_at, created_at), 'error', error)
    from public.itinerary_generation_operations where trip_id = p_trip_id
    order by coalesce(lease_started_at, created_at) desc limit 1), 'null'::jsonb));
  select * into quest from public.trip_quests where trip_id = p_trip_id;
  if not found then return result; end if;
  if quest.stage <> 'complete' then
    return result || jsonb_build_object('lockedDestination', null, 'latest', null, 'operation', null);
  end if;
  country_name := '{"MY":"Malaysia","TH":"Thailand","ID":"Indonesia","VN":"Vietnam","JP":"Japan","KR":"South Korea","SG":"Singapore","TW":"Taiwan","PH":"Philippines","KH":"Cambodia","LA":"Laos","IN":"India","LK":"Sri Lanka","NP":"Nepal","AU":"Australia","NZ":"New Zealand","GB":"United Kingdom","FR":"France","IT":"Italy","ES":"Spain","TR":"Türkiye","AE":"United Arab Emirates","US":"United States","CA":"Canada"}'::jsonb->>quest.selected_country_code;
  option_id := 'quest:' || quest.selected_country_code || ':' || quest.revision;
  result := jsonb_set(result, '{lockedDestination}', jsonb_build_object('name', country_name, 'country', country_name, 'lockedAt', quest.updated_at));
  if (select locked_destination_option_id from public.trips where id = p_trip_id) is distinct from option_id then
    result := result || jsonb_build_object('latest', null, 'operation', null);
  elsif (result->'operation'->>'startedAt')::timestamptz < quest.updated_at then
    result := jsonb_set(result, '{operation}', 'null'::jsonb);
  end if;
  return result;
end; $$;

create function public.claim_itinerary_generation(p_trip_id uuid, p_member_id uuid, p_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare op public.itinerary_generation_operations%rowtype; token uuid := extensions.gen_random_uuid();
begin
  perform 1 from public.trips where id = p_trip_id for update;
  if not exists(select 1 from public.trip_members where id = p_member_id and trip_id = p_trip_id and active and role = 'organizer') then
    raise exception 'Only the organiser can generate an itinerary.';
  end if;
  select * into op from public.itinerary_generation_operations where trip_id = p_trip_id and idempotency_key = p_key;
  if op.status = 'completed' then return jsonb_build_object('id', op.id, 'status', 'completed'); end if;
  select * into op from public.itinerary_generation_operations where trip_id = p_trip_id and status = 'pending'
    and coalesce(lease_started_at, created_at) > now() - interval '3 minutes' order by created_at desc limit 1;
  if found then return jsonb_build_object('id', op.id, 'status', 'pending'); end if;
  update public.itinerary_generation_operations set status = 'failed', error = 'A newer generation attempt replaced this expired request.', completed_at = now(), lease = null
    where trip_id = p_trip_id and status = 'pending';
  insert into public.itinerary_generation_operations(trip_id, requested_by, idempotency_key, lease, lease_started_at)
    values(p_trip_id, p_member_id, p_key, token, now())
    on conflict(trip_id, idempotency_key) do update set status = 'pending', error = null, completed_at = null, lease = token, lease_started_at = now()
    returning * into op;
  return jsonb_build_object('id', op.id, 'status', 'claimed', 'lease', token);
end; $$;
create function public.store_claimed_itinerary(p_operation_id uuid, p_lease uuid, p_destination_option_id text, p_destination_locked_at timestamptz, p_content jsonb, p_input_snapshot jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target_trip_id uuid;
begin
  select trip_id into target_trip_id from public.itinerary_generation_operations where id = p_operation_id;
  -- Claiming and storing acquire locks in the same order.
  perform 1 from public.trips where id = target_trip_id for update;
  perform 1 from public.itinerary_generation_operations where id = p_operation_id and lease = p_lease and status = 'pending' for update;
  if not found then raise exception using errcode = '22023', message = 'A newer generation attempt has replaced this request. Refresh the itinerary.'; end if;
  return public.store_generated_itinerary(p_operation_id, p_destination_option_id, p_destination_locked_at, p_content, p_input_snapshot);
end; $$;
revoke all on function public.claim_itinerary_generation(uuid, uuid, uuid), public.store_claimed_itinerary(uuid, uuid, text, timestamptz, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.claim_itinerary_generation(uuid, uuid, uuid), public.store_claimed_itinerary(uuid, uuid, text, timestamptz, jsonb, jsonb) to service_role;
notify pgrst, 'reload schema';
