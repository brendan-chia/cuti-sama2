create or replace function private.lock_declared_destination()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.trips trip
  set locked_destination_option_id = 'manual:' || new.id::text,
      locked_destination_name = new.name,
      locked_destination_country = null,
      destination_locked_at = now(),
      destination_unlocked_at = null,
      planning_phase = 'itinerary_planning',
      updated_at = now()
  where trip.id = new.trip_id
    and trip.mode = 'destination_locked'
    and trip.destination_locked_at is null
    and (select count(*) from public.trip_destinations destination where destination.trip_id = new.trip_id) = 1;
  return new;
end;
$$;

drop trigger if exists lock_declared_destination_after_insert on public.trip_destinations;
create trigger lock_declared_destination_after_insert
after insert on public.trip_destinations
for each row execute function private.lock_declared_destination();

revoke all on function private.lock_declared_destination() from public;

update public.trips trip
set locked_destination_option_id = 'manual:' || destination.id::text,
    locked_destination_name = destination.name,
    locked_destination_country = null,
    destination_locked_at = now(),
    destination_unlocked_at = null,
    planning_phase = 'itinerary_planning',
    updated_at = now()
from public.trip_destinations destination
where trip.id = destination.trip_id
  and trip.mode = 'destination_locked'
  and trip.destination_locked_at is null
  and (select count(*) from public.trip_destinations candidate where candidate.trip_id = trip.id) = 1;
