-- The quest is independent of legacy planning rounds. Private member inputs are
-- exposed only as the caller's own values and deliberately delayed aggregates.
create table public.trip_quests (
  trip_id uuid primary key references public.trips(id) on delete cascade,
  stage text not null default 'timing' check (stage in ('timing', 'picks', 'voting', 'explore', 'budget', 'complete')),
  revision bigint not null default 0,
  period jsonb,
  countries text[] not null default '{}',
  results jsonb not null default '[]' check (jsonb_typeof(results) = 'array'),
  tied_country_codes text[] not null default '{}',
  selected_country_code text,
  attraction_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trip_quest_inputs (
  trip_id uuid not null references public.trip_quests(trip_id) on delete cascade,
  member_id uuid not null references public.trip_members(id) on delete cascade,
  starts_on date,
  ends_on date,
  country_codes text[] not null default '{}',
  votes jsonb not null default '{}' check (jsonb_typeof(votes) = 'object'),
  budget integer check (budget between 1 and 1000000),
  primary key (trip_id, member_id),
  check ((starts_on is null and ends_on is null) or (starts_on is not null and ends_on is not null and ends_on >= starts_on)),
  check (cardinality(country_codes) <= 3)
);

-- Seeded below from the bundled map catalog; IDs must belong to the chosen country.
create table public.trip_quest_attractions (
  id text primary key,
  country_code text not null check (country_code in ('MY','TH','ID','VN','JP','KR','SG','TW','PH','KH','LA','IN','LK','NP','AU','NZ','GB','FR','IT','ES','TR','AE','US','CA'))
);

alter table public.trip_quests enable row level security;
alter table public.trip_quest_inputs enable row level security;
alter table public.trip_quest_attractions enable row level security;
revoke all on public.trip_quests, public.trip_quest_inputs, public.trip_quest_attractions from anon, authenticated;
grant select on public.trip_quests, public.trip_quest_inputs, public.trip_quest_attractions to authenticated;
grant all on public.trip_quests, public.trip_quest_inputs, public.trip_quest_attractions to service_role;

create or replace function private.is_quest_participant(p_trip_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.trip_quest_inputs input
    join public.trip_members member on member.id = input.member_id and member.trip_id = input.trip_id
    where input.trip_id = p_trip_id and member.active and member.user_id = (select auth.uid()));
$$;
revoke all on function private.is_quest_participant(uuid) from public;
grant execute on function private.is_quest_participant(uuid) to authenticated;

create policy "Quest participants see shared progress" on public.trip_quests for select to authenticated
  using ((select private.is_quest_participant(trip_id)));
create policy "Quest members see only their own inputs" on public.trip_quest_inputs for select to authenticated
  using (exists (select 1 from public.trip_members member where member.id = trip_quest_inputs.member_id and member.trip_id = trip_quest_inputs.trip_id and member.active and member.user_id = (select auth.uid())));
create policy "Members see the public attraction catalog" on public.trip_quest_attractions for select to authenticated using (true);

-- Both invitation joins and member removal now serialize against quest actions.
create or replace function private.guard_quest_membership()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.trips where id = new.trip_id for update;
  if new.active and (tg_op = 'INSERT' or not old.active) and exists (
    select 1 from public.trip_quests where trip_id = new.trip_id
  ) then
    raise exception using errcode = '22023', message = 'This trip has started its planning quest. Joining is closed.';
  end if;
  return new;
end;
$$;
create trigger a_trip_quest_membership_guard before insert or update of active on public.trip_members
  for each row execute function private.guard_quest_membership();

create or replace function private.guard_quest_invitation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.revoked_at is null then
    perform 1 from public.trips where id = new.trip_id for update;
    if exists (select 1 from public.trip_quests where trip_id = new.trip_id) then
      raise exception using errcode = '22023', message = 'Invitations are closed while this trip is on its planning quest.';
    end if;
  end if;
  return new;
end;
$$;
create trigger a_trip_quest_invitation_guard before insert or update of revoked_at on public.invites
  for each row execute function private.guard_quest_invitation();

create or replace function private.reconcile_trip_quest(p_trip_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare quest public.trip_quests%rowtype; leaders text[]; top_count integer; totals jsonb;
begin
  perform 1 from public.trips where id = p_trip_id for update;
  select * into quest from public.trip_quests where trip_id = p_trip_id;
  if quest.trip_id is null then return; end if;
  if quest.stage = 'picks' and not exists (
    select 1 from public.trip_quest_inputs input join public.trip_members member on member.id = input.member_id
    where input.trip_id = p_trip_id and member.active and cardinality(input.country_codes) = 0
  ) then
    update public.trip_quests set stage = 'voting', countries = array(
      select distinct code from public.trip_quest_inputs input
      join public.trip_members member on member.id = input.member_id
      cross join lateral unnest(input.country_codes) code
      where input.trip_id = p_trip_id and member.active order by code
    ), updated_at = now() where trip_id = p_trip_id returning * into quest;
  end if;
  if quest.stage = 'voting' and cardinality(quest.countries) > 0 and not exists (
    select 1 from public.trip_quest_inputs input join public.trip_members member on member.id = input.member_id
    where input.trip_id = p_trip_id and member.active and not (input.votes ?& quest.countries)
  ) then
    select jsonb_agg(jsonb_build_object('countryCode', country_code, 'agreeCount', agree_count) order by agree_count desc, country_code), max(agree_count)
      into totals, top_count
      from (select code as country_code, count(*) filter (where input.votes->code = 'true'::jsonb)::integer as agree_count
        from unnest(quest.countries) code
        cross join public.trip_quest_inputs input join public.trip_members member on member.id = input.member_id
        where input.trip_id = p_trip_id and member.active group by code) counts;
    select array_agg(result->>'countryCode' order by result->>'countryCode') into leaders
      from jsonb_array_elements(totals) result where (result->>'agreeCount')::integer = top_count and top_count > 0;
    update public.trip_quests set results = totals,
      tied_country_codes = case when cardinality(leaders) > 1 then leaders else '{}'::text[] end,
      selected_country_code = case when cardinality(leaders) = 1 then leaders[1] else null end,
      stage = case when cardinality(leaders) = 1 then 'explore' else 'voting' end,
      updated_at = now() where trip_id = p_trip_id;
  end if;
end;
$$;

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
    'ownAvailability', case when own_input.starts_on is not null then jsonb_build_object('startsOn', own_input.starts_on, 'endsOn', own_input.ends_on) else null end,
    'sharedAvailability', case when availability_count = member_count and shared_end >= shared_start then jsonb_build_object('startsOn', shared_start, 'endsOn', shared_end) else null end,
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
    if quest.stage <> 'timing' then raise exception using errcode = '22023', message = 'Availability is locked after the trip period is chosen.'; end if;
    if jsonb_typeof(p_action->'startsOn') is distinct from 'string' or jsonb_typeof(p_action->'endsOn') is distinct from 'string'
      or p_action->>'startsOn' !~ '^\d{4}-\d{2}-\d{2}$' or p_action->>'endsOn' !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception using errcode = '22023', message = 'Enter valid availability dates.';
    end if;
    begin start_date := (p_action->>'startsOn')::date; end_date := (p_action->>'endsOn')::date;
    exception when datetime_field_overflow or invalid_datetime_format then raise exception using errcode = '22023', message = 'Enter valid availability dates.'; end;
    if start_date <= current_date or end_date < start_date or end_date > (current_date + interval '3 years')::date then
      raise exception using errcode = '22023', message = 'Availability must be in the future and within the next three years.';
    end if;
    update public.trip_quest_inputs set starts_on = start_date, ends_on = end_date where trip_id = p_trip_id and member_id = caller_member.id;
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
      raise exception using errcode = '22023', message = 'The suggested trip period is invalid.';
    end if;
    begin start_date := (p_action->'period'->>'startsOn')::date; end_date := (p_action->'period'->>'endsOn')::date;
    exception when datetime_field_overflow or invalid_datetime_format then raise exception using errcode = '22023', message = 'The suggested trip period is invalid.'; end;
    if start_date <= current_date or end_date - start_date + 1 not between 2 and 14 or exists (
      select 1 from public.trip_quest_inputs input join public.trip_members member on member.id = input.member_id
      where input.trip_id = p_trip_id and member.active and (input.starts_on is null or input.starts_on > start_date or input.ends_on < end_date)
    ) then raise exception using errcode = '22023', message = 'Choose a future 2–14 day period inside every member’s submitted availability.'; end if;
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

create or replace function private.quest_member_removed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.active and not new.active and exists (select 1 from public.trip_quests where trip_id = new.trip_id) then
    perform private.reconcile_trip_quest(new.trip_id);
    update public.trip_quests set updated_at = now(), revision = revision + 1 where trip_id = new.trip_id;
  end if;
  return null;
end;
$$;
create trigger trip_quest_member_removed after update of active on public.trip_members for each row execute function private.quest_member_removed();

create or replace function private.can_access_quest_topic(target_topic text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.trip_quest_inputs input join public.trip_members member on member.id = input.member_id
    where member.user_id = (select auth.uid()) and member.active and target_topic = 'trip:' || input.trip_id::text || ':quest');
$$;
revoke all on function private.can_access_quest_topic(text) from public;
grant execute on function private.can_access_quest_topic(text) to authenticated;
create policy "Participants receive private quest changes" on realtime.messages for select to authenticated
  using (extension = 'broadcast' and (select private.can_access_quest_topic(realtime.topic())));

create or replace function private.broadcast_trip_quest_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- No preferences, dates, votes or budgets are broadcast. Each caller reloads
  -- through the authenticated RPC to receive only their permitted snapshot.
  perform realtime.send(jsonb_build_object('entity', 'quest'), 'quest_changed', 'trip:' || new.trip_id::text || ':quest', true);
  return null;
end;
$$;
create trigger trip_quest_broadcast after insert or update on public.trip_quests for each row execute function private.broadcast_trip_quest_change();

revoke all on function private.guard_quest_membership(), private.guard_quest_invitation(), private.reconcile_trip_quest(uuid), private.quest_member_removed(), private.broadcast_trip_quest_change() from public;
revoke all on function public.get_trip_quest(uuid), public.update_trip_quest(uuid, jsonb, uuid) from public, anon;
grant execute on function public.get_trip_quest(uuid), public.update_trip_quest(uuid, jsonb, uuid) to authenticated;

insert into public.trip_quest_attractions(id, country_code) values
  ('my-petronas-towers', 'MY'),
  ('my-george-town', 'MY'),
  ('my-kinabalu-park', 'MY'),
  ('th-wat-arun', 'TH'),
  ('th-ayutthaya', 'TH'),
  ('th-sukhothai', 'TH'),
  ('id-borobudur', 'ID'),
  ('id-prambanan', 'ID'),
  ('id-komodo', 'ID'),
  ('vn-ha-long-bay', 'VN'),
  ('vn-hoi-an', 'VN'),
  ('vn-my-son', 'VN'),
  ('jp-fushimi-inari', 'JP'),
  ('jp-sensoji', 'JP'),
  ('jp-mount-fuji', 'JP'),
  ('kr-changdeokgung', 'KR'),
  ('kr-bulguksa', 'KR'),
  ('kr-seongsan-ilchulbong', 'KR'),
  ('sg-gardens-by-the-bay', 'SG'),
  ('sg-merlion-park', 'SG'),
  ('sg-botanic-gardens', 'SG'),
  ('tw-taipei-101', 'TW'),
  ('tw-sun-moon-lake', 'TW'),
  ('tw-national-palace-museum', 'TW'),
  ('ph-tubbataha', 'PH'),
  ('ph-batad-rice-terraces', 'PH'),
  ('ph-underground-river', 'PH'),
  ('kh-angkor-wat', 'KH'),
  ('kh-preah-vihear', 'KH'),
  ('kh-sambor-prei-kuk', 'KH'),
  ('la-luang-prabang', 'LA'),
  ('la-vat-phou', 'LA'),
  ('la-plain-of-jars', 'LA'),
  ('in-taj-mahal', 'IN'),
  ('in-agra-fort', 'IN'),
  ('in-ajanta-caves', 'IN'),
  ('lk-sigiriya', 'LK'),
  ('lk-kandy', 'LK'),
  ('lk-galle-fort', 'LK'),
  ('np-lumbini', 'NP'),
  ('np-sagarmatha', 'NP'),
  ('np-chitwan', 'NP'),
  ('au-sydney-opera-house', 'AU'),
  ('au-great-barrier-reef', 'AU'),
  ('au-royal-exhibition-building', 'AU'),
  ('nz-tongariro', 'NZ'),
  ('nz-milford-sound', 'NZ'),
  ('nz-waitomo-caves', 'NZ'),
  ('gb-tower-of-london', 'GB'),
  ('gb-stonehenge', 'GB'),
  ('gb-edinburgh-old-town', 'GB'),
  ('fr-eiffel-tower', 'FR'),
  ('fr-mont-saint-michel', 'FR'),
  ('fr-versailles', 'FR'),
  ('it-colosseum', 'IT'),
  ('it-leaning-tower', 'IT'),
  ('it-pompeii', 'IT'),
  ('es-sagrada-familia', 'ES'),
  ('es-alhambra', 'ES'),
  ('es-cordoba-mosque-cathedral', 'ES'),
  ('tr-hagia-sophia', 'TR'),
  ('tr-goreme', 'TR'),
  ('tr-pamukkale', 'TR'),
  ('ae-burj-khalifa', 'AE'),
  ('ae-sheikh-zayed-mosque', 'AE'),
  ('ae-al-ain-oasis', 'AE'),
  ('us-statue-of-liberty', 'US'),
  ('us-grand-canyon', 'US'),
  ('us-yellowstone', 'US'),
  ('ca-lake-louise', 'CA'),
  ('ca-old-quebec', 'CA'),
  ('ca-rideau-canal', 'CA');

-- Preserve legacy invitation behavior while serializing with quest startup.
create or replace function public.manage_invite(
  p_trip_id uuid,
  p_action text,
  p_token_hash text,
  p_expires_at timestamptz,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  organizer_id uuid;
  current_invite public.invites%rowtype;
  existing_response jsonb;
  result jsonb;
begin
  if caller_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required.';
  end if;

  select member.id into organizer_id
  from public.trip_members member
  where member.trip_id = p_trip_id
    and member.user_id = caller_id
    and member.role = 'organizer'
    and member.active;

  if organizer_id is null then
    raise exception using errcode = '42501', message = 'Only the organiser can manage invitations.';
  end if;

  -- Match quest initialization lock order before touching invitation rows.
  perform 1 from public.trips where id = p_trip_id for update;
  if p_action in ('issue', 'rotate') and exists (select 1 from public.trip_quests where trip_id = p_trip_id) then
    raise exception using errcode = '22023', message = 'Invitations are closed while this trip is on its planning quest.';
  end if;

  select invite.* into current_invite
  from public.invites invite
  where invite.trip_id = p_trip_id and invite.revoked_at is null
  order by invite.created_at desc limit 1;

  if p_action = 'status' then
    if current_invite.id is not null and current_invite.expires_at > now() then
      return jsonb_build_object('status', 'open', 'inviteId', current_invite.id, 'expiresAt', current_invite.expires_at);
    end if;
    if current_invite.id is not null then
      update public.invites set revoked_at = now() where id = current_invite.id;
    end if;
    if exists (select 1 from public.invites where trip_id = p_trip_id) then
      return jsonb_build_object('status', 'closed');
    end if;
    return jsonb_build_object('status', 'never_issued');
  end if;

  if p_action not in ('issue', 'rotate', 'close') or p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'Invitation action is invalid.';
  end if;

  select request.response into existing_response
  from public.request_idempotency request
  where request.user_id = caller_id
    and request.operation = 'manage_invite_' || p_action
    and request.idempotency_key = p_idempotency_key;
  if found and existing_response is not null then return existing_response; end if;

  insert into public.request_idempotency (user_id, operation, idempotency_key)
  values (caller_id, 'manage_invite_' || p_action, p_idempotency_key)
  on conflict do nothing;

  if p_action = 'close' then
    update public.invites set revoked_at = now()
    where trip_id = p_trip_id and revoked_at is null;
    result := jsonb_build_object('status', 'closed');
  else
    if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
       or p_expires_at is null or p_expires_at <= now() then
      raise exception using errcode = '22023', message = 'Invitation token or expiry is invalid.';
    end if;
    update public.invites set revoked_at = now()
    where trip_id = p_trip_id and revoked_at is null;
    insert into public.invites (trip_id, token_hash, created_by_member_id, expires_at)
    values (p_trip_id, p_token_hash, organizer_id, p_expires_at)
    returning * into current_invite;
    result := jsonb_build_object(
      'status', 'open', 'inviteId', current_invite.id,
      'expiresAt', current_invite.expires_at, 'tokenHash', current_invite.token_hash
    );
  end if;

  update public.request_idempotency set response = result
  where user_id = caller_id
    and operation = 'manage_invite_' || p_action
    and idempotency_key = p_idempotency_key;
  return result;
end;
$$;
