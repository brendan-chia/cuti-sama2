-- Adapt completed quests to the existing versioned itinerary storage.
create or replace function public.prepare_quest_itinerary(p_trip_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare quest public.trip_quests%rowtype; room jsonb; country_name text; option_id text;
begin
  if not private.is_active_trip_member(p_trip_id) then
    raise exception using errcode = '42501', message = 'Trip Room access is unavailable.';
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
returns jsonb language plpgsql security definer set search_path = '' as $$
declare prepared jsonb; result jsonb;
begin
  prepared := public.prepare_quest_itinerary(p_trip_id);
  result := public.get_itinerary_state(p_trip_id);
  if prepared is not null and (result->'operation'->>'startedAt')::timestamptz < (prepared->>'updatedAt')::timestamptz then
    result := jsonb_set(result, '{operation}', 'null'::jsonb);
  end if;
  return result;
end; $$;

-- The existing store RPC locks the trip before inserting. Reject stale quest drafts
-- even if membership changed while the model was working.
create or replace function private.validate_quest_itinerary_snapshot()
returns trigger language plpgsql security definer set search_path = '' as $$
declare quest public.trip_quests%rowtype; base_snapshot jsonb;
begin
  if new.revision_operation_id is not null then
    select input_snapshot into base_snapshot from public.itinerary_versions
      where id = (new.input_snapshot->>'revisionOf')::uuid and trip_id = new.trip_id;
    new.input_snapshot := coalesce(base_snapshot, '{}'::jsonb) || new.input_snapshot;
  end if;
  select * into quest from public.trip_quests where trip_id = new.trip_id;
  if found and (quest.stage <> 'complete' or
      (new.input_snapshot->>'questRevision')::bigint is distinct from quest.revision) then
    raise exception using errcode = '22023', message = 'The group plan changed during generation. Generate a new itinerary from the latest plan.';
  end if;
  return new;
end; $$;
create trigger validate_quest_itinerary_snapshot before insert on public.itinerary_versions
for each row execute function private.validate_quest_itinerary_snapshot();

revoke all on function public.prepare_quest_itinerary(uuid), public.get_planning_itinerary_state(uuid) from public, anon;
grant execute on function public.prepare_quest_itinerary(uuid), public.get_planning_itinerary_state(uuid) to authenticated;
revoke all on function private.validate_quest_itinerary_snapshot() from public;

notify pgrst, 'reload schema';
