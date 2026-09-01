alter table public.trip_members
  add column lobby_ready boolean not null default false,
  add column lobby_ready_at timestamptz;

alter table public.trips
  add column planning_started_at timestamptz;

create index trip_members_active_trip_idx
  on public.trip_members (trip_id, created_at)
  where active;

create or replace function private.enforce_active_member_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.active and (tg_op = 'INSERT' or not old.active) and (
    select count(*) from public.trip_members
    where trip_id = new.trip_id and active
  ) >= 8 then
    raise exception using errcode = '22023', message = 'This Trip Room already has eight active members.';
  end if;
  return new;
end;
$$;

create trigger trip_members_active_limit
before insert or update of active on public.trip_members
for each row execute function private.enforce_active_member_limit();

create or replace function public.get_trip_lobby(p_trip_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_member public.trip_members%rowtype;
  result jsonb;
begin
  if caller_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required.';
  end if;

  select * into caller_member
  from public.trip_members
  where trip_id = p_trip_id and user_id = caller_id and active;

  if caller_member.id is null then
    raise exception using errcode = '42501', message = 'Trip Room access is unavailable.';
  end if;

  select jsonb_build_object(
    'tripId', trip.id,
    'tripName', trip.name,
    'mode', trip.mode,
    'startedAt', trip.planning_started_at,
    'joiningOpen', exists (
      select 1 from public.invites invite
      where invite.trip_id = trip.id
        and invite.revoked_at is null
        and invite.expires_at > now()
    ),
    'currentMemberId', caller_member.id,
    'currentRole', caller_member.role,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'memberId', member.id,
        'displayName', member.display_name,
        'discriminator', member.display_name_discriminator,
        'role', member.role,
        'ready', member.lobby_ready,
        'joinedAt', member.created_at
      ) order by case when member.role = 'organizer' then 0 else 1 end, member.created_at)
      from public.trip_members member
      where member.trip_id = trip.id and member.active
    ), '[]'::jsonb)
  ) into result
  from public.trips trip
  where trip.id = p_trip_id;

  return result;
end;
$$;

create or replace function public.set_lobby_ready(
  p_trip_id uuid,
  p_ready boolean,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare caller_id uuid := (select auth.uid());
begin
  if caller_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required.';
  end if;
  if p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'Request identifier is required.';
  end if;
  if exists (select 1 from public.trips where id = p_trip_id and planning_started_at is not null) then
    raise exception using errcode = '22023', message = 'Planning has already begun.';
  end if;

  update public.trip_members
  set lobby_ready = p_ready,
      lobby_ready_at = case when p_ready then coalesce(lobby_ready_at, now()) else null end
  where trip_id = p_trip_id and user_id = caller_id and active;

  if not found then
    raise exception using errcode = '42501', message = 'Trip Room access is unavailable.';
  end if;
  return public.get_trip_lobby(p_trip_id);
end;
$$;

create or replace function public.remove_trip_member(
  p_trip_id uuid,
  p_member_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_member public.trip_members%rowtype;
begin
  if not (select private.is_trip_organizer(p_trip_id)) then
    raise exception using errcode = '42501', message = 'Only the organiser can remove a member.';
  end if;
  if p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'Request identifier is required.';
  end if;

  select * into target_member from public.trip_members
  where id = p_member_id and trip_id = p_trip_id for update;
  if target_member.id is null then
    raise exception using errcode = 'P0002', message = 'Member was not found.';
  end if;
  if target_member.role = 'organizer' then
    raise exception using errcode = '22023', message = 'The organiser cannot be removed.';
  end if;

  update public.trip_members
  set active = false, lobby_ready = false, lobby_ready_at = null
  where id = target_member.id and active;
  return public.get_trip_lobby(p_trip_id);
end;
$$;

create or replace function public.start_trip_planning(
  p_trip_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare target_trip public.trips%rowtype;
begin
  if not (select private.is_trip_organizer(p_trip_id)) then
    raise exception using errcode = '42501', message = 'Only the organiser can start planning.';
  end if;
  if p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'Request identifier is required.';
  end if;

  select * into target_trip from public.trips where id = p_trip_id for update;
  if target_trip.planning_started_at is null and exists (
    select 1 from public.trip_members
    where trip_id = p_trip_id and active and not lobby_ready
  ) then
    raise exception using errcode = '22023', message = 'Every active member must be ready before planning can begin.';
  end if;
  if target_trip.planning_started_at is null then
    update public.trips set planning_started_at = now(), updated_at = now()
    where id = p_trip_id;
  end if;
  return public.get_trip_lobby(p_trip_id);
end;
$$;

create or replace function private.can_access_lobby_topic(target_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trip_members member
    where member.user_id = (select auth.uid())
      and member.active
      and target_topic = 'trip:' || member.trip_id::text || ':lobby'
  );
$$;

revoke all on function private.can_access_lobby_topic(text) from public;
grant execute on function private.can_access_lobby_topic(text) to authenticated;

create policy "Members can receive private lobby events"
  on realtime.messages for select to authenticated
  using (
    extension in ('broadcast', 'presence')
    and (select private.can_access_lobby_topic(realtime.topic()))
  );

create policy "Members can publish lobby presence"
  on realtime.messages for insert to authenticated
  with check (
    extension = 'presence'
    and (select private.can_access_lobby_topic(realtime.topic()))
  );

create or replace function private.broadcast_trip_member_lobby_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'entity', 'member',
      'memberId', coalesce(new.id, old.id),
      'active', coalesce(new.active, false)
    ),
    'lobby_changed',
    'trip:' || coalesce(new.trip_id, old.trip_id)::text || ':lobby',
    true
  );
  return null;
end;
$$;

create or replace function private.broadcast_trip_lobby_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('entity', 'trip'),
    'lobby_changed',
    'trip:' || new.id::text || ':lobby',
    true
  );
  return null;
end;
$$;

create or replace function private.broadcast_invite_lobby_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('entity', 'invite'),
    'lobby_changed',
    'trip:' || coalesce(new.trip_id, old.trip_id)::text || ':lobby',
    true
  );
  return null;
end;
$$;

create trigger trip_members_lobby_broadcast
after insert or update of active, lobby_ready on public.trip_members
for each row execute function private.broadcast_trip_member_lobby_change();

create trigger trips_lobby_broadcast
after update of planning_started_at on public.trips
for each row execute function private.broadcast_trip_lobby_change();

create trigger invites_lobby_broadcast
after insert or update of revoked_at on public.invites
for each row execute function private.broadcast_invite_lobby_change();

revoke all on function public.get_trip_lobby(uuid) from public, anon;
revoke all on function public.set_lobby_ready(uuid, boolean, uuid) from public, anon;
revoke all on function public.remove_trip_member(uuid, uuid, uuid) from public, anon;
revoke all on function public.start_trip_planning(uuid, uuid) from public, anon;
grant execute on function public.get_trip_lobby(uuid) to authenticated;
grant execute on function public.set_lobby_ready(uuid, boolean, uuid) to authenticated;
grant execute on function public.remove_trip_member(uuid, uuid, uuid) to authenticated;
grant execute on function public.start_trip_planning(uuid, uuid) to authenticated;
