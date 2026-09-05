-- Flexible preferences remain private; only validated recommendation metrics are shared.
alter table public.trip_quest_inputs add column date_preferences jsonb not null default '{"flexibility":"7","daysOff":[0,6],"unavailable":[]}';
alter table public.trip_quests add column date_recommendation jsonb;
alter table public.trip_quests add column recommendation_revision bigint;
create table public.national_holiday_calendar (
  id integer primary key check (id = 1), version text not null,
  covered_years integer[] not null, holidays jsonb not null check (jsonb_typeof(holidays) = 'array'),
  source_url text not null, checked_at date not null, notice text not null
);
alter table public.national_holiday_calendar enable row level security;
revoke all on public.national_holiday_calendar from anon, authenticated;
grant select on public.national_holiday_calendar to authenticated;
grant all on public.national_holiday_calendar to service_role;
create policy "Signed in users may read the national calendar" on public.national_holiday_calendar for select to authenticated using (true);

create function private.validate_date_preferences(p jsonb)
returns void language plpgsql set search_path = '' as $$
declare item jsonb; begin
  if jsonb_typeof(p) is distinct from 'object' or coalesce(p->>'flexibility','') not in ('exact','3','7','month')
    or jsonb_typeof(p->'daysOff') is distinct from 'array' or jsonb_typeof(p->'unavailable') is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Choose date flexibility, days off and unavailable dates.';
  end if;
  if jsonb_array_length(p->'daysOff') > 7 or jsonb_array_length(p->'unavailable') > 20
    or exists (select 1 from jsonb_array_elements(p->'daysOff') d where jsonb_typeof(d) <> 'number' or d::text !~ '^[0-6]$')
    or (select count(*) <> count(distinct d) from jsonb_array_elements(p->'daysOff') d) then
    raise exception using errcode = '22023', message = 'Invalid days off or too many unavailable ranges.';
  end if;
  for item in select * from jsonb_array_elements(p->'unavailable') loop
    if coalesce(item->>'startsOn','') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(item->>'endsOn','') !~ '^\d{4}-\d{2}-\d{2}$'
      or (item->>'endsOn')::date < (item->>'startsOn')::date then
      raise exception using errcode = '22023', message = 'Enter valid unavailable date ranges.';
    end if;
  end loop;
end; $$;
revoke all on function private.validate_date_preferences(jsonb) from public;

insert into public.national_holiday_calendar values (1, 'my-national-2026-2027-20260905-v1', array[2026,2027], '[{"date": "2026-02-17", "name": "Chinese New Year"}, {"date": "2026-03-21", "name": "Hari Raya Aidilfitri"}, {"date": "2026-03-22", "name": "Hari Raya Aidilfitri (second day)"}, {"date": "2026-05-01", "name": "Labour Day"}, {"date": "2026-05-27", "name": "Hari Raya Aidiladha"}, {"date": "2026-05-31", "name": "Wesak Day"}, {"date": "2026-06-01", "name": "Birthday of the Yang di-Pertuan Agong"}, {"date": "2026-06-17", "name": "Awal Muharram"}, {"date": "2026-08-25", "name": "Maulidur Rasul"}, {"date": "2026-08-31", "name": "National Day"}, {"date": "2026-09-16", "name": "Malaysia Day"}, {"date": "2026-12-25", "name": "Christmas Day"}, {"date": "2027-02-06", "name": "Chinese New Year"}, {"date": "2027-03-10", "name": "Hari Raya Aidilfitri"}, {"date": "2027-03-11", "name": "Hari Raya Aidilfitri (second day)"}, {"date": "2027-05-01", "name": "Labour Day"}, {"date": "2027-05-17", "name": "Hari Raya Aidiladha"}, {"date": "2027-05-20", "name": "Wesak Day"}, {"date": "2027-06-06", "name": "Awal Muharram"}, {"date": "2027-06-07", "name": "Birthday of the Yang di-Pertuan Agong"}, {"date": "2027-08-15", "name": "Maulidur Rasul"}, {"date": "2027-08-31", "name": "National Day"}, {"date": "2027-09-16", "name": "Malaysia Day"}, {"date": "2027-12-25", "name": "Christmas Day"}]'::jsonb, 'https://www.kabinet.gov.my/hari-kelepasan-am/', '2026-09-05', 'Nationwide holidays only. State-specific and conditional substitute days are excluded. Published 2026–2027 schedules, subject to official changes. Leave is an estimate; confirm your employer’s calendar.');

-- Collect each traveller’s proposal and reveal all proposals after everyone submits.
create or replace function public.get_trip_quest(p_trip_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target_trip public.trips%rowtype;
  caller_member public.trip_members%rowtype;
  quest public.trip_quests%rowtype;
  own_input public.trip_quest_inputs%rowtype;
  shared_start date; shared_end date; member_count integer; availability_count integer; budget_count integer;
  minimum_budget integer;
begin
  if (select auth.uid()) is null then raise exception using errcode = '28000', message = 'Authentication is required.'; end if;
  select * into target_trip from public.trips where id = p_trip_id for update;
  select * into caller_member from public.trip_members where trip_id = p_trip_id and user_id = (select auth.uid()) and active;
  if caller_member.id is null then raise exception using errcode = '42501', message = 'Trip Room access is unavailable.'; end if;
  if target_trip.planning_started_at is null then raise exception using errcode = '22023', message = 'Start planning in the lobby first.'; end if;
  if not exists (select 1 from public.trip_quests where trip_id = p_trip_id) then
    insert into public.trip_quests(trip_id) values (p_trip_id);
    insert into public.trip_quest_inputs(trip_id, member_id)
      select p_trip_id, id from public.trip_members where trip_id = p_trip_id and active;
    update public.invites set revoked_at = now() where trip_id = p_trip_id and revoked_at is null;
  end if;
  if not private.is_quest_participant(p_trip_id) then raise exception using errcode = '42501', message = 'You are not an active participant in this trip quest.'; end if;
  select * into quest from public.trip_quests where trip_id = p_trip_id;
  select * into own_input from public.trip_quest_inputs where trip_id = p_trip_id and member_id = caller_member.id;
  select count(*)::integer, count(input.starts_on)::integer, max(input.starts_on), min(input.ends_on),
      count(input.budget)::integer, min(input.budget)
    into member_count, availability_count, shared_start, shared_end, budget_count, minimum_budget
    from public.trip_quest_inputs input join public.trip_members member on member.id = input.member_id
    where input.trip_id = p_trip_id and member.active;
  return jsonb_build_object(
    'tripId', p_trip_id, 'tripName', target_trip.name, 'currentMemberId', caller_member.id,
    'currentRole', caller_member.role, 'stage', quest.stage, 'revision', quest.revision,
    'members', (select jsonb_agg(jsonb_build_object(
      'memberId', member.id, 'displayName', member.display_name,
      'availabilitySubmitted', input.starts_on is not null,
      'picksSubmitted', cardinality(input.country_codes) > 0,
      'votesSubmitted', cardinality(quest.countries) > 0 and input.votes ?& quest.countries,
      'budgetSubmitted', input.budget is not null
    ) order by case when member.role = 'organizer' then 0 else 1 end, member.created_at, member.id)
      from public.trip_quest_inputs input join public.trip_members member on member.id = input.member_id
      where input.trip_id = p_trip_id and member.active),
    'dateProposals', case when availability_count = member_count then (
      select coalesce(jsonb_agg(jsonb_build_object('memberId', member.id, 'startsOn', input.starts_on, 'endsOn', input.ends_on)
        order by member.created_at, member.id), '[]'::jsonb)
      from public.trip_quest_inputs input join public.trip_members member on member.id = input.member_id
      where input.trip_id = p_trip_id and member.active
    ) else '[]'::jsonb end,
    'ownDatePreferences', own_input.date_preferences,
    'dateRecommendation', case when quest.recommendation_revision = quest.revision and quest.date_recommendation->>'calendarVersion' = (select version from public.national_holiday_calendar where id = 1) then quest.date_recommendation else null end,
    'ownAvailability', case when own_input.starts_on is not null then jsonb_build_object('startsOn', own_input.starts_on, 'endsOn', own_input.ends_on) else null end,
    'sharedAvailability', case when availability_count = member_count and shared_end >= shared_start then jsonb_build_object('startsOn', shared_start, 'endsOn', shared_end) else null end,
    'importedPlaces', (select coalesce(jsonb_agg(p.place || jsonb_build_object('confirmedBy', p.confirmed_by, 'sourcePost', p.source_post) order by p.created_at, p.place_id), '[]'::jsonb) from public.trip_confirmed_places p where p.trip_id = p_trip_id),
    'period', quest.period, 'ownPicks', own_input.country_codes, 'countries', quest.countries,
    'ownVotes', own_input.votes, 'results', quest.results, 'tiedCountryCodes', quest.tied_country_codes,
    'selectedCountryCode', quest.selected_country_code, 'attractionIds', quest.attraction_ids, 'ownBudget', own_input.budget,
    'budgetSummary', case when budget_count = member_count and budget_count > 0 then jsonb_build_object(
      'submittedCount', budget_count,
      'comfortablePerPerson', minimum_budget, 'currency', 'MYR') else null end
  );
end;
$$;

create or replace function public.update_trip_quest(p_trip_id uuid, p_action jsonb, p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  caller_member public.trip_members%rowtype; quest public.trip_quests%rowtype;
  prior_operation public.operation_keys%rowtype; fingerprint text; response_snapshot jsonb;
  action_type text := p_action->>'type'; start_date date; end_date date;
  codes text[]; selected_attractions text[]; selected text; amount numeric;
begin
  if (select auth.uid()) is null then raise exception using errcode = '28000', message = 'Authentication is required.'; end if;
  if p_idempotency_key is null or p_action is null or jsonb_typeof(p_action) <> 'object' or action_type is null
    or action_type not in ('availability','period','picks','vote','resolve_tie','restart_picks','attractions','budget','finish') then
    raise exception using errcode = '22023', message = 'Quest action is invalid.';
  end if;
  -- The same lock governs initialize, joins, removal, ballots and every transition.
  perform public.get_trip_quest(p_trip_id);
  select * into caller_member from public.trip_members where trip_id = p_trip_id and user_id = (select auth.uid()) and active;
  select * into quest from public.trip_quests where trip_id = p_trip_id;
  fingerprint := encode(extensions.digest(jsonb_build_object('tripId', p_trip_id, 'action', p_action)::text, 'sha256'), 'hex');
  insert into public.operation_keys(owner_user_id, operation, idempotency_key, request_hash)
    values ((select auth.uid()), 'trip-quest', p_idempotency_key, fingerprint) on conflict do nothing;
  select * into prior_operation from public.operation_keys
    where owner_user_id = (select auth.uid()) and operation = 'trip-quest' and idempotency_key = p_idempotency_key for update;
  if prior_operation.request_hash <> fingerprint then raise exception using errcode = '22023', message = 'This request identifier was already used for a different quest action.'; end if;
  if prior_operation.status = 'completed' then return public.get_trip_quest(p_trip_id); end if;
  if action_type in ('period','resolve_tie','restart_picks','attractions','finish') and caller_member.role <> 'organizer' then
    raise exception using errcode = '42501', message = 'Only the organiser can advance this quest stage.';
  end if;

  if action_type = 'availability' then
    if quest.stage <> 'timing' then raise exception using errcode = '22023', message = 'Date proposals are locked after the trip period is chosen.'; end if;
    if jsonb_typeof(p_action->'startsOn') is distinct from 'string' or jsonb_typeof(p_action->'endsOn') is distinct from 'string'
      or p_action->>'startsOn' !~ '^\d{4}-\d{2}-\d{2}$' or p_action->>'endsOn' !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception using errcode = '22023', message = 'Enter valid proposed dates.';
    end if;
    begin start_date := (p_action->>'startsOn')::date; end_date := (p_action->>'endsOn')::date;
    exception when datetime_field_overflow or invalid_datetime_format then raise exception using errcode = '22023', message = 'Enter valid proposed dates.'; end;
    if start_date <= current_date or end_date - start_date + 1 not between 1 and 30 or end_date > (current_date + interval '3 years')::date then
      raise exception using errcode = '22023', message = 'Propose a future trip of 1–30 days within the next three years.';
    end if;
    perform private.validate_date_preferences(coalesce(p_action->'preferences', '{"flexibility":"7","daysOff":[0,6],"unavailable":[]}'::jsonb));
    update public.trip_quest_inputs set date_preferences = coalesce(p_action->'preferences', '{"flexibility":"7","daysOff":[0,6],"unavailable":[]}'::jsonb), starts_on = start_date, ends_on = end_date where trip_id = p_trip_id and member_id = caller_member.id;
  elsif action_type = 'period' then
    if quest.stage <> 'timing' then raise exception using errcode = '22023', message = 'The trip period has already been chosen.'; end if;
    if jsonb_typeof(p_action->'period') is distinct from 'object'
      or jsonb_typeof(p_action->'period'->'startsOn') is distinct from 'string'
      or jsonb_typeof(p_action->'period'->'endsOn') is distinct from 'string'
      or (p_action->'period'->>'startsOn') !~ '^\d{4}-\d{2}-\d{2}$'
      or (p_action->'period'->>'endsOn') !~ '^\d{4}-\d{2}-\d{2}$'
      or jsonb_typeof(p_action->'period'->'label') is distinct from 'string'
      or jsonb_typeof(p_action->'period'->'reason') is distinct from 'string'
      or char_length(btrim(p_action->'period'->>'label')) not between 1 and 120
      or char_length(btrim(p_action->'period'->>'reason')) not between 1 and 1200 then
      raise exception using errcode = '22023', message = 'The proposed trip period is invalid.';
    end if;
    begin start_date := (p_action->'period'->>'startsOn')::date; end_date := (p_action->'period'->>'endsOn')::date;
    exception when datetime_field_overflow or invalid_datetime_format then raise exception using errcode = '22023', message = 'The proposed trip period is invalid.'; end;
    if start_date <= current_date or end_date - start_date + 1 not between 1 and 30 or exists (
      select 1 from public.trip_quest_inputs input join public.trip_members member on member.id = input.member_id
      where input.trip_id = p_trip_id and member.active and input.starts_on is null
    ) or not exists (
      select 1 from jsonb_array_elements(quest.date_recommendation->'periods') candidate
      where candidate->>'startsOn' = start_date::text and candidate->>'endsOn' = end_date::text
        and quest.recommendation_revision = quest.revision
        and quest.date_recommendation->>'calendarVersion' = (select version from public.national_holiday_calendar where id = 1)
    ) then raise exception using errcode = '22023', message = 'Generate a fresh recommendation after everyone submits, then confirm one of its periods.'; end if;
    select jsonb_build_object('type', 'period', 'period', candidate) into p_action
      from jsonb_array_elements(quest.date_recommendation->'periods') candidate
      where candidate->>'startsOn' = start_date::text and candidate->>'endsOn' = end_date::text limit 1;
    update public.trip_quests set period = jsonb_build_object('startsOn', start_date, 'endsOn', end_date,
      'label', btrim(p_action->'period'->>'label'), 'reason', btrim(p_action->'period'->>'reason')), stage = 'picks' where trip_id = p_trip_id;
    update public.trips set starts_on = start_date, ends_on = end_date, updated_at = now() where id = p_trip_id;
  elsif action_type = 'picks' then
    if quest.stage <> 'picks' then raise exception using errcode = '22023', message = 'Country picks are locked for this round.'; end if;
    if jsonb_typeof(p_action->'countryCodes') is distinct from 'array' then raise exception using errcode = '22023', message = 'Choose one to three different supported countries.'; end if;
    select array_agg(value) into codes from jsonb_array_elements_text(p_action->'countryCodes');
    if coalesce(cardinality(codes), 0) not between 1 and 3
      or cardinality(codes) <> (select count(distinct code) from unnest(codes) code)
      or not codes <@ array['MY','TH','ID','VN','JP','KR','SG','TW','PH','KH','LA','IN','LK','NP','AU','NZ','GB','FR','IT','ES','TR','AE','US','CA'] then
      raise exception using errcode = '22023', message = 'Choose one to three different supported countries.';
    end if;
    update public.trip_quest_inputs set country_codes = codes where trip_id = p_trip_id and member_id = caller_member.id;
  elsif action_type = 'vote' then
    if quest.stage <> 'voting' or jsonb_array_length(quest.results) > 0 then raise exception using errcode = '22023', message = 'Voting is already closed.'; end if;
    selected := p_action->>'countryCode';
    if selected is null or not selected = any(quest.countries) or jsonb_typeof(p_action->'agree') is distinct from 'boolean' then
      raise exception using errcode = '22023', message = 'Vote agree or disagree on a country in this round.';
    end if;
    update public.trip_quest_inputs set votes = jsonb_set(votes, array[selected], p_action->'agree') where trip_id = p_trip_id and member_id = caller_member.id;
  elsif action_type = 'resolve_tie' then
    selected := p_action->>'countryCode';
    if quest.stage <> 'voting' or jsonb_array_length(quest.results) = 0 or selected is null or not selected = any(quest.tied_country_codes) then
      raise exception using errcode = '22023', message = 'Choose one of the tied countries after everyone has voted.';
    end if;
    update public.trip_quests set selected_country_code = selected, tied_country_codes = '{}', stage = 'explore' where trip_id = p_trip_id;
  elsif action_type = 'restart_picks' then
    if quest.stage <> 'voting' or jsonb_array_length(quest.results) = 0 or exists (
      select 1 from jsonb_array_elements(quest.results) result where (result->>'agreeCount')::integer > 0
    ) then raise exception using errcode = '22023', message = 'Start fresh picks only when everyone has voted and no country received a like.'; end if;
    update public.trip_quest_inputs set country_codes = '{}', votes = '{}' where trip_id = p_trip_id;
    update public.trip_quests set stage = 'picks', countries = '{}', results = '[]', tied_country_codes = '{}' where trip_id = p_trip_id;
  elsif action_type = 'attractions' then
    if quest.stage <> 'explore' then raise exception using errcode = '22023', message = 'Choose attractions after a country has been decided.'; end if;
    if jsonb_typeof(p_action->'attractionIds') is distinct from 'array' then raise exception using errcode = '22023', message = 'Choose at least one attraction in the selected country.'; end if;
    select array_agg(value) into selected_attractions from jsonb_array_elements_text(p_action->'attractionIds');
    if coalesce(cardinality(selected_attractions), 0) not between 1 and 20
      or cardinality(selected_attractions) <> (select count(distinct id) from unnest(selected_attractions) id)
      or exists (select 1 from unnest(selected_attractions) requested where not exists (
        select 1 from public.trip_quest_attractions catalog where catalog.id = requested and catalog.country_code = quest.selected_country_code
        union all select 1 from public.trip_confirmed_places p where p.trip_id = p_trip_id and p.place_id = requested and p.place->>'countryCode' = quest.selected_country_code
      )) then raise exception using errcode = '22023', message = 'Choose at least one attraction in the selected country.'; end if;
    update public.trip_quests set attraction_ids = selected_attractions, stage = 'budget' where trip_id = p_trip_id;
  elsif action_type = 'budget' then
    if quest.stage <> 'budget' then raise exception using errcode = '22023', message = 'Budgets can be submitted during the budget stage.'; end if;
    if jsonb_typeof(p_action->'amount') is distinct from 'number' then raise exception using errcode = '22023', message = 'Enter a whole MYR budget between 1 and 1,000,000.'; end if;
    amount := (p_action->>'amount')::numeric;
    if amount <> trunc(amount) or amount not between 1 and 1000000 then raise exception using errcode = '22023', message = 'Enter a whole MYR budget between 1 and 1,000,000.'; end if;
    update public.trip_quest_inputs set budget = amount::integer where trip_id = p_trip_id and member_id = caller_member.id;
  elsif action_type = 'finish' then
    if quest.stage <> 'budget' or exists (
      select 1 from public.trip_quest_inputs input join public.trip_members member on member.id = input.member_id
      where input.trip_id = p_trip_id and member.active and input.budget is null
    ) then raise exception using errcode = '22023', message = 'Everyone must submit a budget before the organiser can finish.'; end if;
    update public.trip_quests set stage = 'complete' where trip_id = p_trip_id;
  end if;

  perform private.reconcile_trip_quest(p_trip_id);
  update public.trip_quests set updated_at = now(), revision = revision + 1 where trip_id = p_trip_id;
  response_snapshot := public.get_trip_quest(p_trip_id);
  update public.operation_keys set status = 'completed', response = response_snapshot, response_status = 200, updated_at = now()
    where owner_user_id = (select auth.uid()) and operation = 'trip-quest' and idempotency_key = p_idempotency_key;
  return response_snapshot;
end;
$$;


notify pgrst, 'reload schema';

-- Only the authenticated edge function's service client can publish recommendations.
create function public.save_date_recommendation(p_trip_id uuid, p_member_id uuid, p_revision bigint, p_recommendation jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare q public.trip_quests%rowtype; begin
  perform 1 from public.trips where id = p_trip_id for update;
  select * into q from public.trip_quests where trip_id = p_trip_id;
  if q.trip_id is null or q.stage <> 'timing' or q.revision <> p_revision or not exists (
    select 1 from public.trip_members m where m.trip_id = p_trip_id and m.id = p_member_id and m.active and m.role = 'organizer'
  ) or exists (select 1 from public.trip_quest_inputs i join public.trip_members m on m.id = i.member_id where i.trip_id = p_trip_id and m.active and i.starts_on is null)
    or p_recommendation->>'calendarVersion' is distinct from (select version from public.national_holiday_calendar where id = 1)
  then return false; end if;
  -- A concurrent request reuses the already-published answer, never overwrites it.
  if q.recommendation_revision = q.revision and q.date_recommendation->>'calendarVersion' = p_recommendation->>'calendarVersion' then return false; end if;
  update public.trip_quests set date_recommendation = p_recommendation, revision = revision + 1,
    recommendation_revision = revision + 1, updated_at = now() where trip_id = p_trip_id;
  return true;
end; $$;
revoke all on function public.save_date_recommendation(uuid,uuid,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.save_date_recommendation(uuid,uuid,bigint,jsonb) to service_role;
notify pgrst, 'reload schema';
