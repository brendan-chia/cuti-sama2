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
  select * into caller_member from public.trip_members
  where trip_id = p_trip_id and user_id = caller_id and active;
  if caller_member.id is null then
    raise exception using errcode = '42501', message = 'Trip Room access is unavailable.';
  end if;

  select jsonb_build_object(
    'tripId', trip.id, 'tripName', trip.name, 'mode', trip.mode,
    'startedAt', trip.planning_started_at,
    'joiningOpen', exists (select 1 from public.invites invite where invite.trip_id = trip.id and invite.revoked_at is null and invite.expires_at > now()),
    'currentMemberId', caller_member.id, 'currentRole', caller_member.role,
    'constraintsLockedAt', trip.constraints_locked_at,
    'constraintsCanLock', trip.constraints_locked_at is null and not exists (
      select 1 from public.trip_members active_member where active_member.trip_id = trip.id and active_member.active
        and not exists (select 1 from public.member_constraints constraint_row where constraint_row.member_id = active_member.id)
    ),
    'members', coalesce((select jsonb_agg(jsonb_build_object(
      'memberId', member.id, 'displayName', member.display_name,
      'discriminator', member.display_name_discriminator, 'role', member.role,
      'ready', member.lobby_ready,
      'constraintComplete', exists (select 1 from public.member_constraints constraint_row where constraint_row.member_id = member.id),
      'joinedAt', member.created_at
    ) order by case when member.role = 'organizer' then 0 else 1 end, member.created_at)
      from public.trip_members member where member.trip_id = trip.id and member.active), '[]'::jsonb)
  ) into result from public.trips trip where trip.id = p_trip_id;
  return result;
end;
$$;

drop trigger trips_lobby_broadcast on public.trips;
create trigger trips_lobby_broadcast
after update of planning_started_at, constraints_locked_at on public.trips
for each row execute function private.broadcast_trip_lobby_change();
