-- Extend the existing private input store. The legacy limit remains the hard cap.
-- Equal backfilled endpoints preserve old affordability without inventing flexibility.
alter table public.trip_quest_inputs rename column budget to max_budget_myr;
alter table public.trip_quest_inputs add column comfortable_budget_myr integer;
update public.trip_quest_inputs set comfortable_budget_myr = max_budget_myr;
alter table public.trip_quest_inputs add constraint private_budget_range_check check (
  (comfortable_budget_myr is null and max_budget_myr is null) or
  (comfortable_budget_myr is not null and max_budget_myr is not null
    and comfortable_budget_myr between 1 and 1000000
    and max_budget_myr between comfortable_budget_myr and 1000000)
);
-- Preserve progress while collecting missing early budgets in already-persisted rooms.
alter table public.trip_quests add column budget_resume_stage text
  check (budget_resume_stage in ('picks','voting','explore','logistics','complete'));
update public.trip_quests set budget_resume_stage = 'logistics' where stage = 'budget';
update public.trip_quests q set budget_resume_stage = q.stage, stage = 'budget'
  where q.stage in ('picks','voting','explore','logistics','complete') and exists (
    select 1 from public.trip_quest_inputs i join public.trip_members m on m.id = i.member_id
    where i.trip_id = q.trip_id and m.active and i.comfortable_budget_myr is null
  );
update public.trip_quests set revision = revision + 1, updated_at = now();
-- RLS/grants are unchanged: only the owner's input row is readable; broadcasts contain only an invalidation notice.

create or replace function public.get_trip_quest(p_trip_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target_trip public.trips%rowtype;
  caller_member public.trip_members%rowtype;
  quest public.trip_quests%rowtype;
  own_input public.trip_quest_inputs%rowtype;
  shared_start date; shared_end date; member_count integer; availability_count integer; budget_count integer;
  minimum_budget integer; minimum_comfort integer;
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
      count(input.comfortable_budget_myr)::integer, min(input.max_budget_myr), min(input.comfortable_budget_myr)
    into member_count, availability_count, shared_start, shared_end, budget_count, minimum_budget, minimum_comfort
    from public.trip_quest_inputs input join public.trip_members member on member.id = input.member_id
    where input.trip_id = p_trip_id and member.active;
  return jsonb_build_object(
    'travelParty', target_trip.travel_party, 'tripId', p_trip_id, 'tripName', target_trip.name, 'currentMemberId', caller_member.id,
    'currentRole', caller_member.role, 'stage', quest.stage, 'revision', quest.revision,
    'members', (select jsonb_agg(jsonb_build_object(
      'memberId', member.id, 'displayName', member.display_name,
      'availabilitySubmitted', input.starts_on is not null,
      'picksSubmitted', cardinality(input.country_codes) > 0,
      'votesSubmitted', cardinality(quest.countries) > 0 and input.votes ?& quest.countries,
      'budgetSubmitted', input.comfortable_budget_myr is not null and input.max_budget_myr is not null
    ) order by case when member.role = 'organizer' then 0 else 1 end, member.created_at, member.id)
      from public.trip_quest_inputs input join public.trip_members member on member.id = input.member_id
      where input.trip_id = p_trip_id and member.active),
    'dateProposals', case when availability_count = member_count then (
      select coalesce(jsonb_agg(jsonb_build_object('memberId', member.id, 'startsOn', input.starts_on, 'endsOn', input.ends_on)
        order by member.created_at, member.id), '[]'::jsonb)
      from public.trip_quest_inputs input join public.trip_members member on member.id = input.member_id
      where input.trip_id = p_trip_id and member.active
    ) else '[]'::jsonb end,
    'ownAvailability', case when own_input.starts_on is not null then jsonb_build_object('startsOn', own_input.starts_on, 'endsOn', own_input.ends_on) else null end,
    'sharedAvailability', case when availability_count = member_count and shared_end >= shared_start then jsonb_build_object('startsOn', shared_start, 'endsOn', shared_end) else null end,
    'importedPlaces', (select coalesce(jsonb_agg(p.place || jsonb_build_object('confirmedBy', p.confirmed_by, 'sourcePost', p.source_post) order by p.created_at, p.place_id), '[]'::jsonb) from public.trip_confirmed_places p where p.trip_id = p_trip_id),
    'period', quest.period, 'ownPicks', own_input.country_codes, 'countries', quest.countries,
    'ownVotes', own_input.votes, 'results', quest.results, 'tiedCountryCodes', quest.tied_country_codes,
    'selectedCountryCode', quest.selected_country_code, 'attractionIds', quest.attraction_ids,
    'attractionVotes', (select coalesce(jsonb_agg(jsonb_build_object('memberId', i.member_id, 'attractionIds', i.attraction_votes) order by i.member_id), '[]'::jsonb)
      from public.trip_quest_inputs i join public.trip_members m on m.id = i.member_id
      where i.trip_id = p_trip_id and m.active and cardinality(i.attraction_votes) > 0), 'ownBudget', case when own_input.comfortable_budget_myr is not null then jsonb_build_object('comfortableBudgetMYR', own_input.comfortable_budget_myr, 'maxBudgetMYR', own_input.max_budget_myr) else null end,
    'logistics', jsonb_build_object(
      'transport', (select coalesce(jsonb_agg(journey || jsonb_build_object('memberId', m.id) order by m.id, journey->>'direction'), '[]'::jsonb)
        from public.trip_quest_inputs i join public.trip_members m on m.id = i.member_id cross join lateral jsonb_array_elements(i.transport) journey where i.trip_id = p_trip_id and m.active),
      'stays', quest.stay_options, 'selectedStayId', quest.selected_stay_id, 'staySkipped', quest.stay_skipped,
      'votes', (select coalesce(jsonb_agg(jsonb_build_object('memberId', m.id, 'stayId', i.stay_vote) order by m.id), '[]'::jsonb) from public.trip_quest_inputs i join public.trip_members m on m.id = i.member_id where i.trip_id = p_trip_id and m.active and i.stay_vote is not null),
      'skippedMemberIds', (select coalesce(jsonb_agg(m.id order by m.id), '[]'::jsonb) from public.trip_quest_inputs i join public.trip_members m on m.id = i.member_id where i.trip_id = p_trip_id and m.active and i.transport_skipped)
    ),
    'budgetSummary', case when budget_count = member_count and budget_count > 0 then jsonb_build_object(
      'submittedCount', budget_count,
      'crewComfortCeiling', minimum_comfort, 'crewHardCeiling', minimum_budget, 'currency', 'MYR') else null end
  ) || case when quest.stage = 'timing' then jsonb_build_object(
    'ownDatePreferences', own_input.date_preferences,
    'dateRecommendation', case when quest.recommendation_revision = quest.revision and quest.date_recommendation->>'calendarVersion' = (select version from public.national_holiday_calendar where id = 1) then quest.date_recommendation else null end
  ) else '{}'::jsonb end;
end;
$$;


-- Confirm solo dates directly while retaining group date recommendations.
create or replace function public.update_trip_quest(p_trip_id uuid, p_action jsonb, p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  caller_member public.trip_members%rowtype; quest public.trip_quests%rowtype;
  prior_operation public.operation_keys%rowtype; fingerprint text; response_snapshot jsonb;
  action_type text := p_action->>'type'; start_date date; end_date date;
  codes text[]; selected_attractions text[]; selected text; amount numeric; comfort numeric; option_value jsonb; stay_cost numeric; member_count integer; target_member_id uuid;
begin
  if (select auth.uid()) is null then raise exception using errcode = '28000', message = 'Authentication is required.'; end if;
  if p_idempotency_key is null or p_action is null or jsonb_typeof(p_action) <> 'object' or action_type is null
    or action_type not in ('availability','period','picks','vote','resolve_tie','restart_picks','attractions','attraction_votes','compile_attractions','budget','finish','transport','skip_transport','stay','stay_vote','confirm_stay','skip_stay','complete_logistics','edit_logistics') then
    raise exception using errcode = '22023', message = 'Quest action is invalid.';
  end if;
  -- The same lock governs initialize, joins, removal, ballots and every transition.
  perform public.get_trip_quest(p_trip_id);
  select * into caller_member from public.trip_members where trip_id = p_trip_id and user_id = (select auth.uid()) and active;
  select * into quest from public.trip_quests where trip_id = p_trip_id;
  if (select travel_party from public.trips where id = p_trip_id) = 'solo' then
    if action_type in ('vote','stay_vote','resolve_tie','restart_picks') then
      raise exception using errcode = '22023', message = 'Solo trips choose directly without voting.';
    end if;
    if action_type = 'picks' and jsonb_array_length(p_action->'countryCodes') <> 1 then
      raise exception using errcode = '22023', message = 'Choose one destination for your solo trip.';
    end if;
  end if;
  fingerprint := encode(extensions.digest(jsonb_build_object('tripId', p_trip_id, 'action', p_action)::text, 'sha256'), 'hex');
  insert into public.operation_keys(owner_user_id, operation, idempotency_key, request_hash)
    values ((select auth.uid()), 'trip-quest', p_idempotency_key, fingerprint) on conflict do nothing;
  select * into prior_operation from public.operation_keys
    where owner_user_id = (select auth.uid()) and operation = 'trip-quest' and idempotency_key = p_idempotency_key for update;
  if prior_operation.request_hash <> fingerprint then raise exception using errcode = '22023', message = 'This request identifier was already used for a different quest action.'; end if;
  if prior_operation.status = 'completed' then return public.get_trip_quest(p_trip_id); end if;
  if action_type in ('period','resolve_tie','restart_picks','attractions','compile_attractions','finish','confirm_stay','skip_stay','complete_logistics','edit_logistics') and caller_member.role <> 'organizer' then
    raise exception using errcode = '42501', message = 'Only the organiser can advance this quest stage.';
  end if;

  if action_type in ('transport','skip_transport','stay','stay_vote','confirm_stay','skip_stay','complete_logistics') and quest.stage not in ('logistics','complete') then
    raise exception using errcode = '22023', message = 'Open Logistics before changing travel or stays.';
  end if;
  -- Completed/draft plans remain editable. Reopen only when a choice is saved,
  -- atomically invalidating the old itinerary revision without changing other inputs.
  if action_type in ('transport','skip_transport','stay','stay_vote','confirm_stay','skip_stay') and quest.stage = 'complete' then
    update public.trip_quests set stage = 'logistics' where trip_id = p_trip_id;
  end if;
  target_member_id := caller_member.id;
  if action_type in ('transport','skip_transport') and p_action ? 'memberId' then
    target_member_id := (p_action->>'memberId')::uuid;
    if target_member_id is distinct from caller_member.id and caller_member.role <> 'organizer' then
      raise exception using errcode = '42501', message = 'Only the organiser can enter another traveller’s transport.';
    end if;
    if not exists (select 1 from public.trip_quest_inputs i join public.trip_members m on m.id = i.member_id where i.trip_id = p_trip_id and m.active and m.id = target_member_id) then
      raise exception using errcode = '22023', message = 'Choose an active traveller in this trip.';
    end if;
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
    if (select travel_party from public.trips where id = p_trip_id) = 'solo' then
      update public.trip_quests set period = jsonb_build_object('startsOn', start_date, 'endsOn', end_date,
        'label', 'Your travel dates', 'reason', 'Chosen for your solo trip.'), stage = 'budget' where trip_id = p_trip_id;
      update public.trips set starts_on = start_date, ends_on = end_date, updated_at = now() where id = p_trip_id;
    end if;
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
      'label', btrim(p_action->'period'->>'label'), 'reason', btrim(p_action->'period'->>'reason')), stage = 'budget' where trip_id = p_trip_id;
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
  elsif action_type in ('attractions', 'attraction_votes', 'compile_attractions') then
    if action_type = 'attractions' and (select travel_party from public.trips where id = p_trip_id) <> 'solo' then
      raise exception using errcode = '22023', message = 'Submit attraction votes and compile the group choices.';
    end if;
    if action_type = 'compile_attractions' then
      if exists (
        select 1 from public.trip_quest_inputs i join public.trip_members m on m.id = i.member_id
        where i.trip_id = p_trip_id and m.active and cardinality(i.attraction_votes) = 0
      ) then raise exception using errcode = '22023', message = 'Everyone must vote for attractions before compiling.'; end if;
      p_action := p_action || jsonb_build_object('attractionIds', (
        select jsonb_agg(id order by id) from (
          select distinct unnest(i.attraction_votes) as id
          from public.trip_quest_inputs i join public.trip_members m on m.id = i.member_id
          where i.trip_id = p_trip_id and m.active
        ) choices
      ));
    end if;
    if quest.stage <> 'explore' then raise exception using errcode = '22023', message = 'Choose attractions after a country has been decided.'; end if;
    if jsonb_typeof(p_action->'attractionIds') is distinct from 'array' then raise exception using errcode = '22023', message = 'Choose at least one attraction in the selected country.'; end if;
    select array_agg(value) into selected_attractions from jsonb_array_elements_text(p_action->'attractionIds');
    if coalesce(cardinality(selected_attractions), 0) not between 1 and (case when action_type = 'compile_attractions' then 160 else 20 end)
      or cardinality(selected_attractions) <> (select count(distinct id) from unnest(selected_attractions) id)
      or exists (select 1 from unnest(selected_attractions) requested where not exists (
        select 1 from public.trip_quest_attractions catalog where catalog.id = requested and catalog.country_code = quest.selected_country_code
        union all select 1 from public.trip_confirmed_places p where p.trip_id = p_trip_id and p.place_id = requested and p.place->>'countryCode' = quest.selected_country_code
      )) then raise exception using errcode = '22023', message = 'Choose at least one attraction in the selected country.'; end if;
    if action_type = 'attraction_votes' then
      update public.trip_quest_inputs set attraction_votes = selected_attractions where trip_id = p_trip_id and member_id = caller_member.id;
    else
      update public.trip_quests set attraction_ids = selected_attractions, stage = 'logistics' where trip_id = p_trip_id;
    end if;
  elsif action_type = 'budget' then
    if quest.stage <> 'budget' then raise exception using errcode = '22023', message = 'Budgets can be submitted during the budget stage.'; end if;
    if jsonb_typeof(p_action->'comfortableBudgetMYR') is distinct from 'number'
      or jsonb_typeof(p_action->'maxBudgetMYR') is distinct from 'number'
      or p_action - array['type','comfortableBudgetMYR','maxBudgetMYR'] <> '{}'::jsonb then
      raise exception using errcode = '22023', message = 'Enter comfortable spending and an absolute maximum in whole MYR.';
    end if;
    comfort := (p_action->>'comfortableBudgetMYR')::numeric;
    amount := (p_action->>'maxBudgetMYR')::numeric;
    if comfort <> trunc(comfort) or amount <> trunc(amount) or comfort not between 1 and 1000000
      or amount not between 1 and 1000000 or amount < comfort then
      raise exception using errcode = '22023', message = 'Budgets must be whole MYR from 1 to 1,000,000, with maximum at least comfortable spending.';
    end if;
    update public.trip_quest_inputs set comfortable_budget_myr = comfort::integer, max_budget_myr = amount::integer
      where trip_id = p_trip_id and member_id = caller_member.id;
  elsif action_type = 'finish' then
    if quest.stage <> 'budget' or exists (
      select 1 from public.trip_quest_inputs input join public.trip_members member on member.id = input.member_id
      where input.trip_id = p_trip_id and member.active and (input.comfortable_budget_myr is null or input.max_budget_myr is null)
    ) then raise exception using errcode = '22023', message = 'Everyone must submit a budget before the organiser can finish.'; end if;
    update public.trip_quests set stage = coalesce(budget_resume_stage, 'picks'), budget_resume_stage = null where trip_id = p_trip_id;
  elsif action_type = 'transport' then
    option_value := p_action->'transport';
    perform private.validate_logistics_option(option_value, 'transport');
    if (case when option_value->>'direction' = 'arrival' then left(option_value->>'arrivalAt',10)::date else left(option_value->>'departureAt',10)::date end) not between (quest.period->>'startsOn')::date and (quest.period->>'endsOn')::date then raise exception 'The arrival or journey home must fall within the trip dates.'; end if;
    update public.trip_quest_inputs set transport = (select coalesce(jsonb_agg(item), '[]'::jsonb) from jsonb_array_elements(transport) item where item->>'direction' <> option_value->>'direction') || jsonb_build_array(option_value), transport_skipped = false where trip_id = p_trip_id and member_id = target_member_id;
    if exists (select 1 from public.trip_quest_inputs i cross join lateral jsonb_array_elements(i.transport) a cross join lateral jsonb_array_elements(i.transport) d where i.trip_id = p_trip_id and i.member_id = target_member_id and a->>'direction' = 'arrival' and d->>'direction' = 'departure' and (a->>'arrivalAt')::timestamptz >= (d->>'departureAt')::timestamptz) then raise exception 'Your journey home must leave after you arrive.'; end if;
  elsif action_type = 'skip_transport' then
    update public.trip_quest_inputs set transport_skipped = true where trip_id = p_trip_id and member_id = target_member_id;
  elsif action_type = 'stay' then
    option_value := p_action->'stay';
    perform private.validate_logistics_option(option_value, 'stay');
    if (option_value->>'checkIn')::date < (quest.period->>'startsOn')::date or (option_value->>'checkOut')::date > (quest.period->>'endsOn')::date then raise exception 'Stay dates must fall within the trip dates.'; end if;
    if jsonb_array_length(quest.stay_options) >= 20 or exists (select 1 from jsonb_array_elements(quest.stay_options) item where item->>'id' = option_value->>'id') then raise exception 'Stay already added, or the 20-option limit was reached.'; end if;
    update public.trip_quests set stay_options = stay_options || jsonb_build_array(option_value) where trip_id = p_trip_id;
  elsif action_type in ('stay_vote','confirm_stay') then
    if not exists (select 1 from jsonb_array_elements(quest.stay_options) item where (item->>'id')::uuid = (p_action->>'stayId')::uuid) then raise exception 'Choose an existing stay option.'; end if;
    if action_type = 'stay_vote' then
      update public.trip_quest_inputs set stay_vote = (p_action->>'stayId')::uuid where trip_id = p_trip_id and member_id = caller_member.id;
    else
      update public.trip_quests set selected_stay_id = (p_action->>'stayId')::uuid, stay_skipped = false where trip_id = p_trip_id;
    end if;
  elsif action_type = 'skip_stay' then
    update public.trip_quests set selected_stay_id = null, stay_skipped = true where trip_id = p_trip_id;
  elsif action_type = 'edit_logistics' then
    if quest.stage <> 'complete' then raise exception 'Only a completed plan can be reopened.'; end if;
    update public.trip_quests set stage = 'logistics' where trip_id = p_trip_id;
  elsif action_type = 'complete_logistics' then
    if jsonb_typeof(p_action->'skip') is distinct from 'boolean' or (p_action->>'revision')::bigint is distinct from quest.revision then raise exception 'The logistics summary changed. Review the latest summary before confirming.'; end if;
    if not (p_action->>'skip')::boolean and (quest.selected_stay_id is null or exists (
      select 1 from public.trip_quest_inputs i join public.trip_members m on m.id = i.member_id where i.trip_id = p_trip_id and m.active and (select count(*) from jsonb_array_elements(i.transport) t where t->>'status' in ('selected','booked')) <> 2
    )) then raise exception 'Confirm travel and a stay, or generate a draft for now.'; end if;
    select count(*), min(i.max_budget_myr) into member_count, amount from public.trip_quest_inputs i join public.trip_members m on m.id = i.member_id where i.trip_id = p_trip_id and m.active;
    select coalesce(max((item->>'totalCost')::numeric),0) into stay_cost from jsonb_array_elements(quest.stay_options) item where (item->>'id')::uuid = quest.selected_stay_id;
    if exists(select 1 from public.trip_quest_inputs i join public.trip_members m on m.id = i.member_id where i.trip_id = p_trip_id and m.active and amount < ceil(stay_cost * 100 / member_count) / 100 + (select coalesce(sum((t->>'cost')::numeric),0) from jsonb_array_elements(i.transport) t where t->>'status' in ('selected','booked'))) then raise exception 'Selected transport and accommodation exceed the group budget.'; end if;
    if (select max((t->>'arrivalAt')::timestamptz) from public.trip_quest_inputs i join public.trip_members m on m.id = i.member_id cross join lateral jsonb_array_elements(i.transport) t where i.trip_id = p_trip_id and m.active and t->>'direction' = 'arrival' and t->>'status' in ('selected','booked')) >= (select min((t->>'departureAt')::timestamptz) from public.trip_quest_inputs i join public.trip_members m on m.id = i.member_id cross join lateral jsonb_array_elements(i.transport) t where i.trip_id = p_trip_id and m.active and t->>'direction' = 'departure' and t->>'status' in ('selected','booked')) then raise exception 'The group has no shared time between arrivals and departures. Review transport.'; end if;
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



