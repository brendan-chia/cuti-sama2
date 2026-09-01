alter table public.trip_members
  add column display_name_discriminator smallint not null default 1
  check (display_name_discriminator > 0);

create unique index unique_member_display_name
  on public.trip_members (trip_id, lower(display_name), display_name_discriminator);

create table public.invites (
  id uuid primary key default extensions.gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by_member_id uuid not null references public.trip_members(id) on delete restrict,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create unique index one_open_invite_per_trip
  on public.invites (trip_id)
  where revoked_at is null;

alter table public.invites enable row level security;
revoke all on public.invites from anon, authenticated;

create or replace function private.is_trip_organizer(target_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trip_members member
    where member.trip_id = target_trip_id
      and member.user_id = (select auth.uid())
      and member.role = 'organizer'
      and member.active
  );
$$;

revoke all on function private.is_trip_organizer(uuid) from public;
grant execute on function private.is_trip_organizer(uuid) to authenticated;

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

create or replace function public.resolve_invite(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '28000', message = 'Authentication is required.';
  end if;
  select jsonb_build_object(
    'tripName', trip.name,
    'mode', trip.mode,
    'organizerName', organizer.display_name,
    'expiresAt', invite.expires_at
  ) into result
  from public.invites invite
  join public.trips trip on trip.id = invite.trip_id
  join public.trip_members organizer on organizer.id = trip.organizer_member_id
  where invite.token_hash = p_token_hash
    and invite.revoked_at is null
    and invite.expires_at > now()
    and organizer.active;
  if result is null then
    raise exception using errcode = 'P0002', message = 'Invitation is unavailable.';
  end if;
  return result;
end;
$$;

create or replace function public.join_trip(
  p_token_hash text,
  p_display_name text,
  p_confirm_duplicate boolean,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  target_trip public.trips%rowtype;
  existing_member public.trip_members%rowtype;
  next_discriminator smallint;
  new_member_id uuid;
  existing_response jsonb;
  result jsonb;
begin
  if caller_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required.';
  end if;
  if char_length(btrim(coalesce(p_display_name, ''))) not between 1 and 50 or p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'Display name is invalid.';
  end if;

  select trip.* into target_trip
  from public.invites invite join public.trips trip on trip.id = invite.trip_id
  where invite.token_hash = p_token_hash
    and invite.revoked_at is null and invite.expires_at > now()
  for update of trip;
  if target_trip.id is null then
    raise exception using errcode = 'P0002', message = 'Invitation is unavailable.';
  end if;

  select * into existing_member from public.trip_members
  where trip_id = target_trip.id and user_id = caller_id;
  if existing_member.id is not null then
    if not existing_member.active then
      raise exception using errcode = '42501', message = 'This guest cannot rejoin the Trip Room.';
    end if;
    return jsonb_build_object(
      'status', 'joined', 'tripId', target_trip.id, 'memberId', existing_member.id,
      'tripName', target_trip.name, 'displayName', existing_member.display_name,
      'discriminator', existing_member.display_name_discriminator
    );
  end if;

  select coalesce(max(display_name_discriminator), 0) + 1 into next_discriminator
  from public.trip_members
  where trip_id = target_trip.id and active and lower(display_name) = lower(btrim(p_display_name));

  if next_discriminator > 1 and not coalesce(p_confirm_duplicate, false) then
    return jsonb_build_object(
      'status', 'confirmation_required', 'displayName', btrim(p_display_name),
      'discriminator', next_discriminator
    );
  end if;

  select request.response into existing_response from public.request_idempotency request
  where request.user_id = caller_id and request.operation = 'join_trip'
    and request.idempotency_key = p_idempotency_key;
  if found and existing_response is not null then return existing_response; end if;

  insert into public.trip_members (trip_id, user_id, display_name, display_name_discriminator, role)
  values (target_trip.id, caller_id, btrim(p_display_name), next_discriminator, 'member')
  returning id into new_member_id;

  result := jsonb_build_object(
    'status', 'joined', 'tripId', target_trip.id, 'memberId', new_member_id,
    'tripName', target_trip.name, 'displayName', btrim(p_display_name),
    'discriminator', next_discriminator
  );
  insert into public.request_idempotency (user_id, operation, idempotency_key, response)
  values (caller_id, 'join_trip', p_idempotency_key, result)
  on conflict do nothing;
  return result;
end;
$$;

revoke all on function public.manage_invite(uuid, text, text, timestamptz, uuid) from public;
revoke all on function public.resolve_invite(text) from public;
revoke all on function public.join_trip(text, text, boolean, uuid) from public;
grant execute on function public.manage_invite(uuid, text, text, timestamptz, uuid) to authenticated;
grant execute on function public.resolve_invite(text) to authenticated;
grant execute on function public.join_trip(text, text, boolean, uuid) to authenticated;
