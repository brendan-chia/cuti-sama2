-- Shared execution state is separate from the generated itinerary and private preferences.
create table public.trip_mode_states (
  trip_id uuid primary key references public.trips(id) on delete cascade,
  quest_revision integer not null,
  revision integer not null default 0 check (revision >= 0),
  data jsonb,
  updated_at timestamptz not null default now()
);
alter table public.trip_mode_states enable row level security;
revoke all on public.trip_mode_states from public, anon, authenticated;

create function public.get_trip_mode(p_trip_id uuid, p_quest_revision integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare q public.trip_quests%rowtype; s public.trip_mode_states%rowtype;
begin
  if not exists (select 1 from public.trip_members where trip_id=p_trip_id and user_id=auth.uid() and active)
     or not private.is_quest_participant(p_trip_id) then
    raise exception using errcode='42501', message='Trip access is unavailable.';
  end if;
  select * into q from public.trip_quests where trip_id=p_trip_id;
  if p_quest_revision is null or q.trip_id is null or q.stage <> 'complete' or q.revision <> p_quest_revision then
    raise exception using errcode='40001', message='The itinerary changed. Reload your trip.';
  end if;
  select * into s from public.trip_mode_states where trip_id=p_trip_id;
  if s.trip_id is null or s.quest_revision <> q.revision then
    return jsonb_build_object('revision',0,'data',null);
  end if;
  return jsonb_build_object('revision',s.revision,'data',s.data);
end;
$$;

create function public.save_trip_mode(p_trip_id uuid, p_quest_revision integer, p_revision integer, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare q public.trip_quests%rowtype; s public.trip_mode_states%rowtype;
  field text; day jsonb; stop jsonb; previous_end text; seen text[] := '{}'; dates text[] := '{}'; id text; old_stop jsonb;
begin
  -- Same lock order as quest mutation: trip, then quest/state.
  perform 1 from public.trips t where t.id=p_trip_id for update;
  if not exists (select 1 from public.trip_members where trip_id=p_trip_id and user_id=auth.uid() and active and role='organizer')
     or not private.is_quest_participant(p_trip_id) then
    raise exception using errcode='42501', message='Only the active organiser can update the shared trip.';
  end if;
  select * into q from public.trip_quests where trip_id=p_trip_id for update;
  if p_quest_revision is null or q.trip_id is null or q.stage <> 'complete' or q.revision <> p_quest_revision then
    raise exception using errcode='40001', message='The itinerary changed. Reload your trip.';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or octet_length(p_data::text) > 250000
     or jsonb_typeof(p_data->'days') is distinct from 'array' or jsonb_typeof(p_data->'completedIds') is distinct from 'array'
     or (p_data - 'days' - 'completedIds') <> '{}'::jsonb then
    raise exception 'Invalid trip state.';
  end if;
  if jsonb_array_length(p_data->'days') not between 1 and 30 or jsonb_array_length(p_data->'completedIds') > 600 then raise exception 'Invalid trip size.'; end if;
  for day in select value from jsonb_array_elements(p_data->'days') loop
    if jsonb_typeof(day->'stops') is distinct from 'array' or day->>'date' is null
       or (day->>'date')::date < (q.period->>'startsOn')::date or (day->>'date')::date > (q.period->>'endsOn')::date
       or day->>'date' = any(dates) then raise exception 'Invalid trip day.'; end if;
    if coalesce(day->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Invalid trip date.'; end if;
    foreach field in array array['estimatedActivityCostMYR','estimatedScheduledMinutes','reservedMealBreakMinutes'] loop
      if jsonb_typeof(day->field) is distinct from 'number' or (day->>field)::numeric < 0 or (day->>field)::numeric > 1000000000 then raise exception 'Invalid day estimate.'; end if;
    end loop;
    dates := array_append(dates,day->>'date'); previous_end := null;
    if jsonb_array_length(day->'stops') > 20 then raise exception 'Too many stops.'; end if;
    for stop in select value from jsonb_array_elements(day->'stops') loop
      id := stop->>'attractionId';
      if id is null or length(id) not between 1 and 160 or id = any(seen)
         or coalesce(stop->>'estimatedStartTime','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
         or coalesce(stop->>'estimatedEndTime','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
         or stop->>'estimatedEndTime' <= stop->>'estimatedStartTime'
         or (previous_end is not null and previous_end > stop->>'estimatedStartTime') then raise exception 'Invalid or overlapping stop.'; end if;
      foreach field in array array['estimatedVisitMinutes','estimatedTravelMinutesFromPrevious','includedMealBreakMinutes'] loop
        if jsonb_typeof(stop->field) is distinct from 'number' or (stop->>field)::numeric < 0 or (stop->>field)::numeric > 1440
           or (stop->>field)::numeric <> trunc((stop->>field)::numeric) then raise exception 'Invalid stop duration.'; end if;
      end loop;
      if (stop->>'estimatedVisitMinutes')::integer = 0 then raise exception 'Visit duration must be positive.'; end if;
      seen := array_append(seen,id); previous_end := stop->>'estimatedEndTime';
    end loop;
  end loop;
  if cardinality(dates) <> ((q.period->>'endsOn')::date - (q.period->>'startsOn')::date + 1) then raise exception 'Keep every trip day.'; end if;
  if (select count(*) <> count(distinct value) from jsonb_array_elements_text(p_data->'completedIds')) then raise exception 'Duplicate completion.'; end if;
  for id in select value from jsonb_array_elements_text(p_data->'completedIds') loop
    if id is null or not (id = any(seen)) then raise exception 'Unknown completed stop.'; end if;
  end loop;
  insert into public.trip_mode_states(trip_id,quest_revision) values(p_trip_id,p_quest_revision) on conflict do nothing;
  select * into s from public.trip_mode_states where trip_id=p_trip_id for update;
  if s.quest_revision <> p_quest_revision then
    update public.trip_mode_states set quest_revision=p_quest_revision,revision=0,data=null where trip_id=p_trip_id returning * into s;
  end if;
  -- Retrying a successful write after a lost response is safe.
  if s.revision = p_revision + 1 and s.data = p_data then return jsonb_build_object('revision',s.revision,'data',s.data); end if;
  if p_revision is null or s.revision <> p_revision then
    raise exception using errcode='40001', message='Your crew updated this trip. Reload before applying changes.';
  end if;
  -- A rescue cannot move or remove a stop that remains marked complete.
  for id in select value from jsonb_array_elements_text(coalesce(s.data->'completedIds','[]'::jsonb)) loop
    if p_data->'completedIds' ? id then
      select st.value into old_stop from jsonb_array_elements(s.data->'days') d cross join lateral jsonb_array_elements(d.value->'stops') st where st.value->>'attractionId'=id;
      if not exists (select 1 from jsonb_array_elements(p_data->'days') d cross join lateral jsonb_array_elements(d.value->'stops') st where st.value=old_stop) then raise exception 'Completed stops cannot change.'; end if;
    end if;
  end loop;
  update public.trip_mode_states set data=p_data, revision=revision+1,updated_at=now() where trip_id=p_trip_id returning * into s;
  return jsonb_build_object('revision',s.revision,'data',s.data);
end;
$$;
revoke all on function public.get_trip_mode(uuid,integer), public.save_trip_mode(uuid,integer,integer,jsonb) from public,anon;
grant execute on function public.get_trip_mode(uuid,integer), public.save_trip_mode(uuid,integer,integer,jsonb) to authenticated;
