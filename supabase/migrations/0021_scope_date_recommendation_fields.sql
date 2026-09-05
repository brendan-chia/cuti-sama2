-- Keep timing-only fields out of later-stage payloads, preserving compatibility
-- with independently deployed itinerary functions using strict room contracts.
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
    'ownAvailability', case when own_input.starts_on is not null then jsonb_build_object('startsOn', own_input.starts_on, 'endsOn', own_input.ends_on) else null end,
    'sharedAvailability', case when availability_count = member_count and shared_end >= shared_start then jsonb_build_object('startsOn', shared_start, 'endsOn', shared_end) else null end,
    'importedPlaces', (select coalesce(jsonb_agg(p.place || jsonb_build_object('confirmedBy', p.confirmed_by, 'sourcePost', p.source_post) order by p.created_at, p.place_id), '[]'::jsonb) from public.trip_confirmed_places p where p.trip_id = p_trip_id),
    'period', quest.period, 'ownPicks', own_input.country_codes, 'countries', quest.countries,
    'ownVotes', own_input.votes, 'results', quest.results, 'tiedCountryCodes', quest.tied_country_codes,
    'selectedCountryCode', quest.selected_country_code, 'attractionIds', quest.attraction_ids, 'ownBudget', own_input.budget,
    'budgetSummary', case when budget_count = member_count and budget_count > 0 then jsonb_build_object(
      'submittedCount', budget_count,
      'comfortablePerPerson', minimum_budget, 'currency', 'MYR') else null end
  ) || case when quest.stage = 'timing' then jsonb_build_object(
    'ownDatePreferences', own_input.date_preferences,
    'dateRecommendation', case when quest.recommendation_revision = quest.revision and quest.date_recommendation->>'calendarVersion' = (select version from public.national_holiday_calendar where id = 1) then quest.date_recommendation else null end
  ) else '{}'::jsonb end;
end;
$$;
notify pgrst, 'reload schema';
