create type public.destination_vote_round_status as enum ('open', 'closed', 'tied');
create type public.destination_vote_resolution as enum ('majority', 'constraint_comparison', 'organizer_tie_choice');

alter table public.trips
  add column planning_phase text not null default 'destination_voting'
    check (planning_phase in ('destination_voting', 'itinerary_planning')),
  add column locked_destination_option_id text,
  add column locked_destination_name text,
  add column locked_destination_country text,
  add column destination_locked_at timestamptz,
  add column destination_unlocked_at timestamptz,
  add constraint complete_locked_destination check (
    (destination_locked_at is null and locked_destination_option_id is null and locked_destination_name is null) or
    (destination_locked_at is not null and locked_destination_option_id is not null and locked_destination_name is not null)
  );

create table public.destination_vote_rounds (
  id uuid primary key default extensions.gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  round_number smallint not null check (round_number between 1 and 20),
  status public.destination_vote_round_status not null default 'open',
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 1 and 5),
  result_totals jsonb check (result_totals is null or jsonb_typeof(result_totals) = 'array'),
  tied_option_ids text[] not null default '{}',
  winning_option_id text,
  resolution public.destination_vote_resolution,
  constraint_comparison jsonb check (constraint_comparison is null or jsonb_typeof(constraint_comparison) = 'array'),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (trip_id, round_number),
  check ((status = 'open' and closed_at is null and result_totals is null) or (status <> 'open' and closed_at is not null and result_totals is not null)),
  check (status <> 'tied' or cardinality(tied_option_ids) >= 2)
);

create table public.destination_vote_participants (
  round_id uuid not null references public.destination_vote_rounds(id) on delete cascade,
  member_id uuid not null references public.trip_members(id) on delete cascade,
  joined_snapshot_at timestamptz not null default now(),
  removed_at timestamptz,
  primary key (round_id, member_id)
);

create table public.destination_votes (
  round_id uuid not null references public.destination_vote_rounds(id) on delete cascade,
  member_id uuid not null references public.trip_members(id) on delete cascade,
  option_id text not null,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (round_id, member_id),
  foreign key (round_id, member_id) references public.destination_vote_participants(round_id, member_id) on delete cascade
);

create index destination_vote_rounds_trip_idx on public.destination_vote_rounds (trip_id, round_number desc);
create index destination_votes_option_idx on public.destination_votes (round_id, option_id);
alter table public.destination_vote_rounds enable row level security;
alter table public.destination_vote_participants enable row level security;
alter table public.destination_votes enable row level security;
revoke all on public.destination_vote_rounds, public.destination_vote_participants, public.destination_votes from anon, authenticated;
grant select on public.destination_vote_rounds, public.destination_vote_participants, public.destination_votes to authenticated;

create policy "Active members can read destination vote rounds" on public.destination_vote_rounds for select to authenticated
using ((select private.is_active_trip_member(trip_id)));
create policy "Active members can read destination vote readiness" on public.destination_vote_participants for select to authenticated
using (exists (select 1 from public.destination_vote_rounds round where round.id = round_id and (select private.is_active_trip_member(round.trip_id))));
create policy "Members see only their open destination vote" on public.destination_votes for select to authenticated
using (exists (
  select 1 from public.destination_vote_rounds round
  join public.trip_members viewer on viewer.trip_id = round.trip_id and viewer.user_id = (select auth.uid()) and viewer.active
  where round.id = round_id and (destination_votes.member_id = viewer.id or round.status <> 'open')
));

create or replace function private.can_access_vote_topic(target_topic text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.trip_members member
    where member.user_id = (select auth.uid()) and member.active
      and target_topic = 'trip:' || member.trip_id::text || ':vote'
  );
$$;
revoke all on function private.can_access_vote_topic(text) from public;
grant execute on function private.can_access_vote_topic(text) to authenticated;
create policy "Members can receive private destination vote events"
  on realtime.messages for select to authenticated
  using (extension = 'broadcast' and (select private.can_access_vote_topic(realtime.topic())));

create or replace function private.finish_destination_vote(target_round_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target_round public.destination_vote_rounds%rowtype; totals jsonb; maximum integer; leaders text[];
begin
  select round.* into target_round from public.destination_vote_rounds round where round.id = target_round_id for update;
  if target_round.id is null or target_round.status <> 'open' then return; end if;
  select jsonb_agg(jsonb_build_object('optionId', option_row.option_id, 'total', option_row.total) order by option_row.ordinal),
         max(option_row.total)
  into totals, maximum
  from (
    select option->>'optionId' option_id, ordinal,
      (select count(*) from public.destination_votes vote where vote.round_id = target_round_id and vote.option_id = option->>'optionId')::integer total
    from jsonb_array_elements(target_round.options) with ordinality source(option, ordinal)
  ) option_row;
  if coalesce(maximum, 0) = 0 then raise exception using errcode = '22023', message = 'At least one vote is required before closing.'; end if;
  select coalesce(array_agg(item->>'optionId' order by item->>'optionId'), '{}') into leaders
  from jsonb_array_elements(totals) item where (item->>'total')::integer = maximum;
  update public.destination_vote_rounds set
    status = case when cardinality(leaders) = 1 then 'closed'::public.destination_vote_round_status else 'tied'::public.destination_vote_round_status end,
    result_totals = totals,
    tied_option_ids = case when cardinality(leaders) > 1 then leaders else '{}'::text[] end,
    winning_option_id = case when cardinality(leaders) = 1 then leaders[1] else null end,
    resolution = case when cardinality(leaders) = 1 then 'majority'::public.destination_vote_resolution else null end,
    closed_at = now()
  where id = target_round_id;
end; $$;

create or replace function private.open_destination_vote(p_trip_id uuid, p_options jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare next_number smallint; new_round_id uuid;
begin
  if jsonb_typeof(p_options) <> 'array' or jsonb_array_length(p_options) not between 1 and 5 then
    raise exception using errcode = '22023', message = 'Voting requires one to five destination options.';
  end if;
  select coalesce(max(round.round_number), 0) + 1 into next_number from public.destination_vote_rounds round where round.trip_id = p_trip_id;
  insert into public.destination_vote_rounds (trip_id, round_number, options) values (p_trip_id, next_number, p_options) returning id into new_round_id;
  insert into public.destination_vote_participants (round_id, member_id)
    select new_round_id, member.id from public.trip_members member where member.trip_id = p_trip_id and member.active;
  if not exists (select 1 from public.destination_vote_participants participant where participant.round_id = new_round_id) then
    raise exception using errcode = '22023', message = 'Voting requires at least one active member.';
  end if;
  return new_round_id;
end; $$;

create or replace function public.get_destination_vote_room(p_trip_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare caller_member public.trip_members%rowtype; current_round public.destination_vote_rounds%rowtype; result jsonb;
begin
  select member.* into caller_member from public.trip_members member where member.trip_id = p_trip_id and member.user_id = (select auth.uid()) and member.active;
  if caller_member.id is null then raise exception using errcode = '42501', message = 'Trip Room access is unavailable.'; end if;
  select round.* into current_round from public.destination_vote_rounds round where round.trip_id = p_trip_id order by round.round_number desc limit 1;
  select jsonb_build_object(
    'tripId', trip.id, 'tripName', trip.name, 'currentMemberId', caller_member.id, 'currentRole', caller_member.role,
    'phase', trip.planning_phase,
    'lockedDestination', case when trip.destination_locked_at is null then null else jsonb_build_object(
      'optionId', trip.locked_destination_option_id, 'name', trip.locked_destination_name,
      'country', trip.locked_destination_country, 'lockedAt', trip.destination_locked_at) end,
    'round', case when current_round.id is null then null else jsonb_build_object(
      'roundId', current_round.id, 'roundNumber', current_round.round_number, 'status', current_round.status,
      'options', current_round.options,
      'participantCount', (select count(*) from public.destination_vote_participants participant where participant.round_id = current_round.id and participant.removed_at is null),
      'votedCount', (select count(*) from public.destination_votes vote join public.destination_vote_participants participant on participant.round_id = vote.round_id and participant.member_id = vote.member_id and participant.removed_at is null where vote.round_id = current_round.id),
      'ownVoteOptionId', (select vote.option_id from public.destination_votes vote where vote.round_id = current_round.id and vote.member_id = caller_member.id),
      'totals', case when current_round.status = 'open' then null else current_round.result_totals end,
      'tiedOptionIds', to_jsonb(current_round.tied_option_ids), 'winningOptionId', current_round.winning_option_id,
      'resolution', current_round.resolution, 'constraintComparison', current_round.constraint_comparison, 'closedAt', current_round.closed_at
    ) end
  ) into result from public.trips trip where trip.id = p_trip_id;
  return result;
end; $$;

create or replace function public.submit_destination_vote(p_trip_id uuid, p_round_id uuid, p_option_id text, p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare caller_member public.trip_members%rowtype; target_round public.destination_vote_rounds%rowtype;
begin
  if p_idempotency_key is null then raise exception using errcode = '22023', message = 'Request identifier is required.'; end if;
  select round.* into target_round from public.destination_vote_rounds round where round.id = p_round_id and round.trip_id = p_trip_id for update;
  if target_round.id is null then raise exception using errcode = 'P0002', message = 'Vote round was not found.'; end if;
  if target_round.status <> 'open' then raise exception using errcode = '22023', message = 'Voting is already closed.'; end if;
  if not exists (select 1 from jsonb_array_elements(target_round.options) option where option->>'optionId' = p_option_id) then
    raise exception using errcode = '22023', message = 'Destination is not available in this round.';
  end if;
  select member.* into caller_member from public.trip_members member
    join public.destination_vote_participants participant on participant.member_id = member.id and participant.round_id = p_round_id and participant.removed_at is null
    where member.trip_id = p_trip_id and member.user_id = (select auth.uid()) and member.active;
  if caller_member.id is null then raise exception using errcode = '42501', message = 'You are not an active voter in this round.'; end if;
  insert into public.destination_votes (round_id, member_id, option_id) values (p_round_id, caller_member.id, p_option_id)
    on conflict (round_id, member_id) do update set option_id = excluded.option_id, updated_at = now();
  if not exists (
    select 1 from public.destination_vote_participants participant where participant.round_id = p_round_id and participant.removed_at is null
      and not exists (select 1 from public.destination_votes vote where vote.round_id = p_round_id and vote.member_id = participant.member_id)
  ) then perform private.finish_destination_vote(p_round_id); end if;
  return public.get_destination_vote_room(p_trip_id);
end; $$;

create or replace function public.manage_destination_vote(p_trip_id uuid, p_action text, p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target_trip public.trips%rowtype; current_round public.destination_vote_rounds%rowtype; source_options jsonb; tied_options jsonb; top_score integer; score_leaders text[]; comparison jsonb;
begin
  if p_idempotency_key is null or p_action not in ('start', 'close', 'second_vote', 'constraint_comparison') then raise exception using errcode = '22023', message = 'Vote action is invalid.'; end if;
  if not (select private.is_trip_organizer(p_trip_id)) then raise exception using errcode = '42501', message = 'Only the organiser can manage voting.'; end if;
  select trip.* into target_trip from public.trips trip where trip.id = p_trip_id for update;
  if target_trip.destination_locked_at is not null then raise exception using errcode = '22023', message = 'Unlock the destination before changing voting.'; end if;
  select round.* into current_round from public.destination_vote_rounds round where round.trip_id = p_trip_id order by round.round_number desc limit 1 for update;
  if p_action = 'start' then
    if current_round.id is not null then raise exception using errcode = '22023', message = 'Destination voting has already started.'; end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'optionId', card->>'destinationId', 'name', card->>'name', 'country', card->'country',
      'constraintScore', (case when (card->>'eligible')::boolean then 100 else 0 end) - 20 * jsonb_array_length(card->'excludedBy') + 2 * jsonb_array_length(card->'matchReasons') +
        (case card->'confidence'->>'level' when 'high' then 3 when 'medium' then 2 else 1 end)
    ) order by ordinal), '[]'::jsonb) into source_options
    from (select run.deterministic_result from public.destination_recommendation_runs run where run.trip_id = p_trip_id order by run.created_at desc limit 1) latest,
      jsonb_array_elements(latest.deterministic_result->'destinations') with ordinality source(card, ordinal);
    if jsonb_array_length(source_options) = 0 then raise exception using errcode = '22023', message = 'Evaluate destinations before starting voting.'; end if;
    perform private.open_destination_vote(p_trip_id, source_options);
  elsif p_action = 'close' then
    if current_round.id is null or current_round.status <> 'open' then raise exception using errcode = '22023', message = 'There is no open vote to close.'; end if;
    perform private.finish_destination_vote(current_round.id);
  elsif p_action = 'second_vote' then
    if current_round.status <> 'tied' then raise exception using errcode = '22023', message = 'A second vote is available only after a tie.'; end if;
    select jsonb_agg(option order by ordinal) into tied_options from jsonb_array_elements(current_round.options) with ordinality source(option, ordinal)
      where option->>'optionId' = any(current_round.tied_option_ids);
    perform private.open_destination_vote(p_trip_id, tied_options);
  else
    if current_round.status <> 'tied' then raise exception using errcode = '22023', message = 'Constraint comparison is available only after a tie.'; end if;
    select max((option->>'constraintScore')::integer) into top_score from jsonb_array_elements(current_round.options) option where option->>'optionId' = any(current_round.tied_option_ids);
    select jsonb_agg(jsonb_build_object('optionId', option->>'optionId', 'score', (option->>'constraintScore')::integer) order by (option->>'constraintScore')::integer desc, option->>'optionId'),
           array_agg(option->>'optionId' order by option->>'optionId') filter (where (option->>'constraintScore')::integer = top_score)
      into comparison, score_leaders from jsonb_array_elements(current_round.options) option where option->>'optionId' = any(current_round.tied_option_ids);
    update public.destination_vote_rounds set constraint_comparison = comparison,
      status = case when cardinality(score_leaders) = 1 then 'closed'::public.destination_vote_round_status else 'tied'::public.destination_vote_round_status end,
      winning_option_id = case when cardinality(score_leaders) = 1 then score_leaders[1] else null end,
      tied_option_ids = case when cardinality(score_leaders) = 1 then '{}'::text[] else score_leaders end,
      resolution = case when cardinality(score_leaders) = 1 then 'constraint_comparison'::public.destination_vote_resolution else null end
      where id = current_round.id;
  end if;
  return public.get_destination_vote_room(p_trip_id);
end; $$;

create or replace function public.set_locked_destination(p_trip_id uuid, p_option_id text, p_action text, p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target_trip public.trips%rowtype; current_round public.destination_vote_rounds%rowtype; selected jsonb;
begin
  if p_idempotency_key is null or p_action not in ('lock', 'unlock') then raise exception using errcode = '22023', message = 'Destination action is invalid.'; end if;
  if not (select private.is_trip_organizer(p_trip_id)) then raise exception using errcode = '42501', message = 'Only the organiser can lock or unlock the destination.'; end if;
  select trip.* into target_trip from public.trips trip where trip.id = p_trip_id for update;
  if p_action = 'unlock' then
    if target_trip.destination_locked_at is not null then update public.trips set locked_destination_option_id = null, locked_destination_name = null, locked_destination_country = null, destination_locked_at = null, destination_unlocked_at = now(), planning_phase = 'destination_voting', updated_at = now() where id = p_trip_id; end if;
    return public.get_destination_vote_room(p_trip_id);
  end if;
  select round.* into current_round from public.destination_vote_rounds round where round.trip_id = p_trip_id order by round.round_number desc limit 1 for update;
  if current_round.id is null or current_round.status = 'open' then raise exception using errcode = '22023', message = 'Close voting before locking a destination.'; end if;
  select option into selected from jsonb_array_elements(current_round.options) option where option->>'optionId' = p_option_id;
  if selected is null then raise exception using errcode = '22023', message = 'Destination is not part of the final vote.'; end if;
  if current_round.winning_option_id is not null and current_round.winning_option_id <> p_option_id then raise exception using errcode = '22023', message = 'Only the recorded winner can be locked.'; end if;
  if current_round.winning_option_id is null and not (p_option_id = any(current_round.tied_option_ids)) then raise exception using errcode = '22023', message = 'A tied finalist must be selected explicitly.'; end if;
  if current_round.winning_option_id is null then update public.destination_vote_rounds set winning_option_id = p_option_id, resolution = 'organizer_tie_choice', status = 'closed', tied_option_ids = '{}' where id = current_round.id; end if;
  update public.trips set locked_destination_option_id = p_option_id, locked_destination_name = selected->>'name', locked_destination_country = selected->>'country', destination_locked_at = now(), planning_phase = 'itinerary_planning', updated_at = now() where id = p_trip_id;
  return public.get_destination_vote_room(p_trip_id);
end; $$;

create or replace function private.remove_member_from_open_destination_votes() returns trigger language plpgsql security definer set search_path = '' as $$
declare affected_round uuid;
begin
  if old.active and not new.active then
    for affected_round in update public.destination_vote_participants participant set removed_at = now()
      from public.destination_vote_rounds round where participant.member_id = new.id and participant.round_id = round.id and round.status = 'open' and participant.removed_at is null returning participant.round_id
    loop
      if exists (select 1 from public.destination_votes vote where vote.round_id = affected_round)
        and not exists (select 1 from public.destination_vote_participants participant where participant.round_id = affected_round and participant.removed_at is null and not exists (select 1 from public.destination_votes vote where vote.round_id = affected_round and vote.member_id = participant.member_id))
      then perform private.finish_destination_vote(affected_round); end if;
    end loop;
  end if;
  return null;
end; $$;
create trigger trip_member_destination_vote_removal after update of active on public.trip_members for each row execute function private.remove_member_from_open_destination_votes();

create or replace function private.broadcast_destination_vote_change() returns trigger language plpgsql security definer set search_path = '' as $$
declare target_round_id uuid; target_trip_id uuid;
begin
  target_round_id := case when tg_table_name = 'destination_vote_rounds' then new.id else new.round_id end;
  select round.trip_id into target_trip_id from public.destination_vote_rounds round where round.id = target_round_id;
  perform realtime.send(jsonb_build_object('entity', tg_table_name, 'roundId', target_round_id), 'vote_changed', 'trip:' || target_trip_id::text || ':vote', true);
  return null;
end; $$;
create trigger destination_vote_round_broadcast after insert or update on public.destination_vote_rounds for each row execute function private.broadcast_destination_vote_change();
create trigger destination_ballot_broadcast after insert or update on public.destination_votes for each row execute function private.broadcast_destination_vote_change();

create or replace function private.broadcast_destination_lock_change() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(jsonb_build_object('entity', 'destination_lock'), 'vote_changed', 'trip:' || new.id::text || ':vote', true);
  return null;
end; $$;
create trigger destination_lock_broadcast after update of destination_locked_at, destination_unlocked_at on public.trips for each row execute function private.broadcast_destination_lock_change();

revoke all on function private.finish_destination_vote(uuid), private.open_destination_vote(uuid, jsonb), private.remove_member_from_open_destination_votes(), private.broadcast_destination_vote_change(), private.broadcast_destination_lock_change() from public;
revoke all on function public.get_destination_vote_room(uuid), public.submit_destination_vote(uuid, uuid, text, uuid), public.manage_destination_vote(uuid, text, uuid), public.set_locked_destination(uuid, text, text, uuid) from public, anon;
grant execute on function public.get_destination_vote_room(uuid), public.submit_destination_vote(uuid, uuid, text, uuid), public.manage_destination_vote(uuid, text, uuid), public.set_locked_destination(uuid, text, text, uuid) to authenticated;
