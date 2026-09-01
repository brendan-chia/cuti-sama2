create type public.preference_round_kind as enum ('vibe', 'pace', 'must_have', 'nice_to_have', 'avoid');

create table public.preference_rounds (
  id uuid primary key default extensions.gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  sequence smallint not null check (sequence between 1 and 5),
  kind public.preference_round_kind not null,
  created_at timestamptz not null default now(),
  revealed_at timestamptz,
  closed_at timestamptz,
  unique (trip_id, sequence),
  unique (trip_id, kind),
  check (closed_at is null or revealed_at is not null)
);

create table public.preference_round_participants (
  round_id uuid not null references public.preference_rounds(id) on delete cascade,
  member_id uuid not null references public.trip_members(id) on delete cascade,
  joined_snapshot_at timestamptz not null default now(),
  removed_at timestamptz,
  primary key (round_id, member_id)
);

create table public.preference_submissions (
  round_id uuid not null references public.preference_rounds(id) on delete cascade,
  member_id uuid not null references public.trip_members(id) on delete cascade,
  value text not null check (char_length(btrim(value)) between 1 and 240),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (round_id, member_id),
  foreign key (round_id, member_id) references public.preference_round_participants(round_id, member_id) on delete cascade
);

create index preference_rounds_trip_idx on public.preference_rounds (trip_id, sequence desc);
create index preference_round_participants_member_idx on public.preference_round_participants (member_id);
create index preference_submissions_member_idx on public.preference_submissions (member_id);

alter table public.preference_rounds enable row level security;
alter table public.preference_round_participants enable row level security;
alter table public.preference_submissions enable row level security;
grant select on public.preference_rounds, public.preference_round_participants, public.preference_submissions to authenticated;
revoke all on public.preference_rounds, public.preference_round_participants, public.preference_submissions from anon;

create policy "Active members can read preference rounds" on public.preference_rounds for select to authenticated
using ((select private.is_active_trip_member(trip_id)));
create policy "Active members can read round readiness" on public.preference_round_participants for select to authenticated
using (exists (select 1 from public.preference_rounds round where round.id = round_id and (select private.is_active_trip_member(round.trip_id))));
create policy "Members see own cards until reveal" on public.preference_submissions for select to authenticated
using (exists (
  select 1 from public.preference_rounds round
  join public.trip_members viewer on viewer.trip_id = round.trip_id and viewer.user_id = (select auth.uid()) and viewer.active
  where round.id = round_id and (
    member_id = viewer.id or (
      round.revealed_at is not null and exists (
        select 1 from public.preference_round_participants participant
        where participant.round_id = round.id and participant.member_id = preference_submissions.member_id and participant.removed_at is null
      )
    )
  )
));

create or replace function private.maybe_reveal_preference_round(target_round_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target_round public.preference_rounds%rowtype;
begin
  select round.* into target_round from public.preference_rounds round where round.id = target_round_id for update;
  if target_round.revealed_at is null
    and exists (select 1 from public.preference_round_participants participant where participant.round_id = target_round_id and participant.removed_at is null)
    and not exists (
      select 1 from public.preference_round_participants participant
      where participant.round_id = target_round_id and participant.removed_at is null
        and not exists (select 1 from public.preference_submissions submission where submission.round_id = target_round_id and submission.member_id = participant.member_id)
    ) then
    update public.preference_rounds set revealed_at = now() where id = target_round_id;
  end if;
end; $$;

create or replace function public.get_preference_room(p_trip_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare caller_member public.trip_members%rowtype; current_round public.preference_rounds%rowtype; result jsonb;
begin
  select member.* into caller_member from public.trip_members member
  where member.trip_id = p_trip_id and member.user_id = (select auth.uid()) and member.active;
  if caller_member.id is null then raise exception using errcode = '42501', message = 'Trip Room access is unavailable.'; end if;
  if not exists (select 1 from public.trips trip where trip.id = p_trip_id and trip.constraints_locked_at is not null) then
    raise exception using errcode = '22023', message = 'Constraints must be locked before preference rounds begin.';
  end if;
  select round.* into current_round from public.preference_rounds round where round.trip_id = p_trip_id order by round.sequence desc limit 1;
  select jsonb_build_object(
    'tripId', trip.id, 'tripName', trip.name, 'currentMemberId', caller_member.id, 'currentRole', caller_member.role,
    'complete', coalesce(current_round.sequence = 5 and current_round.closed_at is not null, false),
    'currentRound', case when current_round.id is null then null else jsonb_build_object(
      'roundId', current_round.id, 'sequence', current_round.sequence, 'kind', current_round.kind,
      'status', case when current_round.closed_at is not null then 'closed' when current_round.revealed_at is not null then 'revealed' else 'collecting' end,
      'createdAt', current_round.created_at, 'revealedAt', current_round.revealed_at, 'closedAt', current_round.closed_at,
      'participantCount', (select count(*) from public.preference_round_participants participant where participant.round_id = current_round.id and participant.removed_at is null),
      'submittedCount', (select count(*) from public.preference_round_participants participant join public.preference_submissions submission on submission.round_id = participant.round_id and submission.member_id = participant.member_id where participant.round_id = current_round.id and participant.removed_at is null),
      'participants', coalesce((select jsonb_agg(jsonb_build_object(
        'memberId', member.id, 'displayName', member.display_name, 'discriminator', member.display_name_discriminator,
        'submitted', submission.member_id is not null, 'removed', participant.removed_at is not null
      ) order by participant.joined_snapshot_at) from public.preference_round_participants participant join public.trip_members member on member.id = participant.member_id left join public.preference_submissions submission on submission.round_id = participant.round_id and submission.member_id = participant.member_id where participant.round_id = current_round.id), '[]'::jsonb),
      'ownSubmission', (select jsonb_build_object('value', submission.value, 'updatedAt', submission.updated_at) from public.preference_submissions submission where submission.round_id = current_round.id and submission.member_id = caller_member.id),
      'revealedSubmissions', case when current_round.revealed_at is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object(
        'memberId', member.id, 'displayName', member.display_name, 'discriminator', member.display_name_discriminator,
        'value', submission.value, 'updatedAt', submission.updated_at
      ) order by submission.submitted_at) from public.preference_submissions submission join public.trip_members member on member.id = submission.member_id join public.preference_round_participants participant on participant.round_id = submission.round_id and participant.member_id = submission.member_id and participant.removed_at is null where submission.round_id = current_round.id), '[]'::jsonb) end
    ) end
  ) into result from public.trips trip where trip.id = p_trip_id;
  return result;
end; $$;

create or replace function public.submit_preference_card(p_trip_id uuid, p_round_id uuid, p_value text, p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare caller_member public.trip_members%rowtype; target_round public.preference_rounds%rowtype;
begin
  if p_idempotency_key is null or char_length(btrim(coalesce(p_value, ''))) not between 1 and 240 then raise exception using errcode = '22023', message = 'Preference card is invalid.'; end if;
  select round.* into target_round from public.preference_rounds round where round.id = p_round_id and round.trip_id = p_trip_id for update;
  if target_round.id is null then raise exception using errcode = 'P0002', message = 'Preference round was not found.'; end if;
  if target_round.revealed_at is not null or target_round.closed_at is not null then raise exception using errcode = '22023', message = 'This preference round has already been revealed.'; end if;
  select member.* into caller_member from public.trip_members member join public.preference_round_participants participant on participant.member_id = member.id and participant.round_id = p_round_id and participant.removed_at is null
  where member.trip_id = p_trip_id and member.user_id = (select auth.uid()) and member.active;
  if caller_member.id is null then raise exception using errcode = '42501', message = 'You are not an active participant in this round.'; end if;
  insert into public.preference_submissions (round_id, member_id, value) values (p_round_id, caller_member.id, btrim(p_value))
  on conflict (round_id, member_id) do update set value = excluded.value, updated_at = now();
  perform private.maybe_reveal_preference_round(p_round_id);
  return public.get_preference_room(p_trip_id);
end; $$;

create or replace function public.manage_preference_round(p_trip_id uuid, p_action text, p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target_trip public.trips%rowtype; current_round public.preference_rounds%rowtype; next_round_id uuid; next_kind public.preference_round_kind;
begin
  if p_idempotency_key is null or p_action not in ('start', 'close', 'advance') then raise exception using errcode = '22023', message = 'Round action is invalid.'; end if;
  if not (select private.is_trip_organizer(p_trip_id)) then raise exception using errcode = '42501', message = 'Only the organiser can manage preference rounds.'; end if;
  select trip.* into target_trip from public.trips trip where trip.id = p_trip_id for update;
  if target_trip.constraints_locked_at is null then raise exception using errcode = '22023', message = 'Constraints must be locked before preference rounds begin.'; end if;
  select round.* into current_round from public.preference_rounds round where round.trip_id = p_trip_id order by round.sequence desc limit 1 for update;
  if p_action = 'start' then
    if current_round.id is not null then raise exception using errcode = '22023', message = 'Preference rounds have already started.'; end if;
    insert into public.preference_rounds (trip_id, sequence, kind) values (p_trip_id, 1, 'vibe') returning id into next_round_id;
    insert into public.preference_round_participants (round_id, member_id) select next_round_id, member.id from public.trip_members member where member.trip_id = p_trip_id and member.active;
  elsif p_action = 'close' then
    if current_round.id is null or current_round.closed_at is not null then raise exception using errcode = '22023', message = 'There is no open round to close.'; end if;
    update public.preference_rounds set revealed_at = coalesce(revealed_at, now()), closed_at = now() where id = current_round.id;
  else
    if current_round.id is null or current_round.closed_at is null then raise exception using errcode = '22023', message = 'Close the current round before advancing.'; end if;
    if current_round.sequence >= 5 then raise exception using errcode = '22023', message = 'All preference rounds are complete.'; end if;
    next_kind := (case current_round.sequence + 1 when 2 then 'pace' when 3 then 'must_have' when 4 then 'nice_to_have' else 'avoid' end)::public.preference_round_kind;
    insert into public.preference_rounds (trip_id, sequence, kind) values (p_trip_id, current_round.sequence + 1, next_kind) returning id into next_round_id;
    insert into public.preference_round_participants (round_id, member_id) select next_round_id, member.id from public.trip_members member where member.trip_id = p_trip_id and member.active;
  end if;
  return public.get_preference_room(p_trip_id);
end; $$;

create or replace function private.remove_member_from_open_rounds() returns trigger language plpgsql security definer set search_path = '' as $$
declare affected_round uuid;
begin
  if old.active and not new.active then
    for affected_round in update public.preference_round_participants participant set removed_at = now() from public.preference_rounds round where participant.member_id = new.id and participant.round_id = round.id and round.revealed_at is null and participant.removed_at is null returning participant.round_id loop
      perform private.maybe_reveal_preference_round(affected_round);
    end loop;
  end if;
  return null;
end; $$;
create trigger trip_member_preference_removal after update of active on public.trip_members for each row execute function private.remove_member_from_open_rounds();

create or replace function private.broadcast_preference_round_change() returns trigger language plpgsql security definer set search_path = '' as $$
declare target_trip_id uuid; safe_round_id uuid;
begin
  if tg_table_name = 'preference_rounds' then safe_round_id := (to_jsonb(new)->>'id')::uuid;
  else safe_round_id := (to_jsonb(new)->>'round_id')::uuid; end if;
  select round.trip_id into target_trip_id from public.preference_rounds round where round.id = safe_round_id;
  perform realtime.send(jsonb_build_object('entity', tg_table_name, 'roundId', safe_round_id), 'lobby_changed', 'trip:' || target_trip_id::text || ':lobby', true);
  return null;
end; $$;
create trigger preference_rounds_broadcast after insert or update of revealed_at, closed_at on public.preference_rounds for each row execute function private.broadcast_preference_round_change();
create trigger preference_participants_broadcast after insert or update of removed_at on public.preference_round_participants for each row execute function private.broadcast_preference_round_change();
create trigger preference_submissions_broadcast after insert or update on public.preference_submissions for each row execute function private.broadcast_preference_round_change();

revoke all on function private.maybe_reveal_preference_round(uuid) from public;
revoke all on function private.remove_member_from_open_rounds() from public;
revoke all on function private.broadcast_preference_round_change() from public;
revoke all on function public.get_preference_room(uuid) from public, anon;
revoke all on function public.submit_preference_card(uuid, uuid, text, uuid) from public, anon;
revoke all on function public.manage_preference_round(uuid, text, uuid) from public, anon;
grant execute on function public.get_preference_room(uuid) to authenticated;
grant execute on function public.submit_preference_card(uuid, uuid, text, uuid) to authenticated;
grant execute on function public.manage_preference_round(uuid, text, uuid) to authenticated;
