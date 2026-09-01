alter table public.trips add column constraints_locked_at timestamptz;

create table public.member_constraints (
  member_id uuid primary key references public.trip_members(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  origin text check (origin is null or char_length(btrim(origin)) between 1 and 120),
  starts_on date,
  ends_on date,
  date_flexibility_days smallint check (date_flexibility_days between 0 and 365),
  budget_min numeric(12,2) check (budget_min > 0),
  budget_max numeric(12,2) check (budget_max > 0),
  currency text check (currency ~ '^[A-Z]{3}$'),
  max_travel_minutes integer check (max_travel_minutes between 1 and 10080),
  accessibility_requirements text check (accessibility_requirements is null or char_length(btrim(accessibility_requirements)) between 1 and 1000),
  accessibility_visibility_consent boolean not null default false,
  climate text check (climate is null or char_length(btrim(climate)) between 1 and 120),
  visa_concern text check (visa_concern is null or char_length(btrim(visa_concern)) between 1 and 500),
  transport text check (transport is null or char_length(btrim(transport)) between 1 and 500),
  accommodation text check (accommodation is null or char_length(btrim(accommodation)) between 1 and 500),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_constraint_dates check (starts_on is null or ends_on is null or ends_on >= starts_on),
  constraint complete_budget_range check ((budget_min is null and budget_max is null and currency is null) or (budget_min is not null and budget_max is not null and currency is not null and budget_max >= budget_min)),
  constraint accessibility_consent_required check (accessibility_requirements is null or accessibility_visibility_consent)
);

create index member_constraints_trip_idx on public.member_constraints (trip_id);
alter table public.member_constraints enable row level security;
grant select, insert, update on public.member_constraints to authenticated;
revoke all on public.member_constraints from anon;

create policy "Members can read their own constraints" on public.member_constraints for select to authenticated
using (exists (select 1 from public.trip_members member where member.id = member_id and member.trip_id = trip_id and member.user_id = (select auth.uid()) and member.active));
create policy "Members can insert their own constraints" on public.member_constraints for insert to authenticated
with check (exists (select 1 from public.trip_members member where member.id = member_id and member.trip_id = trip_id and member.user_id = (select auth.uid()) and member.active));
create policy "Members can update their own constraints" on public.member_constraints for update to authenticated
using (exists (select 1 from public.trip_members member where member.id = member_id and member.trip_id = trip_id and member.user_id = (select auth.uid()) and member.active))
with check (exists (select 1 from public.trip_members member where member.id = member_id and member.trip_id = trip_id and member.user_id = (select auth.uid()) and member.active));

create or replace function private.validate_member_constraint() returns trigger language plpgsql security definer set search_path = '' as $$
declare target_trip public.trips%rowtype;
begin
  select trip.* into target_trip from public.trips trip where trip.id = new.trip_id for update;
  if target_trip.id is null or not exists (select 1 from public.trip_members member where member.id = new.member_id and member.trip_id = new.trip_id and member.active) then
    raise exception using errcode = '22023', message = 'Constraint membership is invalid.';
  end if;
  if target_trip.planning_started_at is null then
    raise exception using errcode = '22023', message = 'Planning must begin before constraints can be submitted.';
  end if;
  if target_trip.constraints_locked_at is not null then raise exception using errcode = '22023', message = 'Constraint collection is locked.'; end if;
  if target_trip.mode = 'undecided' and (new.origin is null or new.starts_on is null or new.ends_on is null or new.date_flexibility_days is null or new.budget_min is null or new.budget_max is null or new.currency is null or new.max_travel_minutes is null or new.accessibility_requirements is null or not new.accessibility_visibility_consent) then
    raise exception using errcode = '22023', message = 'Undecided trips require origin, dates and flexibility, budget and currency, maximum travel time, accessibility requirements, and visibility consent.';
  end if;
  new.updated_at := now(); return new;
end; $$;
create trigger validate_member_constraint_before_write before insert or update on public.member_constraints for each row execute function private.validate_member_constraint();

create or replace function public.get_constraint_collection(p_trip_id uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare caller_member public.trip_members%rowtype; own_constraint public.member_constraints%rowtype; result jsonb;
begin
  select member.* into caller_member from public.trip_members member where member.trip_id = p_trip_id and member.user_id = (select auth.uid()) and member.active;
  if caller_member.id is null then raise exception using errcode = '42501', message = 'Trip Room access is unavailable.'; end if;
  select constraint_row.* into own_constraint from public.member_constraints constraint_row where constraint_row.member_id = caller_member.id;
  select jsonb_build_object(
    'tripId', trip.id, 'tripName', trip.name, 'mode', trip.mode, 'currentMemberId', caller_member.id, 'currentRole', caller_member.role,
    'lockedAt', trip.constraints_locked_at,
    'canLock', trip.constraints_locked_at is null and not exists (select 1 from public.trip_members member where member.trip_id = trip.id and member.active and not exists (select 1 from public.member_constraints constraint_row where constraint_row.member_id = member.id)),
    'members', coalesce((select jsonb_agg(jsonb_build_object('memberId', member.id, 'displayName', member.display_name, 'discriminator', member.display_name_discriminator, 'complete', constraint_row.member_id is not null) order by case when member.role = 'organizer' then 0 else 1 end, member.created_at) from public.trip_members member left join public.member_constraints constraint_row on constraint_row.member_id = member.id where member.trip_id = trip.id and member.active), '[]'::jsonb),
    'ownConstraint', case when own_constraint.member_id is null then null else jsonb_build_object(
      'origin', own_constraint.origin, 'startsOn', own_constraint.starts_on, 'endsOn', own_constraint.ends_on,
      'dateFlexibilityDays', own_constraint.date_flexibility_days, 'budgetMin', own_constraint.budget_min, 'budgetMax', own_constraint.budget_max,
      'currency', own_constraint.currency, 'maxTravelMinutes', own_constraint.max_travel_minutes,
      'accessibilityRequirements', own_constraint.accessibility_requirements, 'accessibilityVisibilityConsent', own_constraint.accessibility_visibility_consent,
      'climate', own_constraint.climate, 'visaConcern', own_constraint.visa_concern, 'transport', own_constraint.transport,
      'accommodation', own_constraint.accommodation, 'submittedAt', own_constraint.submitted_at, 'updatedAt', own_constraint.updated_at
    ) end
  ) into result from public.trips trip where trip.id = p_trip_id;
  return result;
end; $$;

create or replace function public.save_member_constraints(
  p_trip_id uuid, p_origin text, p_starts_on date, p_ends_on date, p_date_flexibility_days smallint,
  p_budget_min numeric, p_budget_max numeric, p_currency text, p_max_travel_minutes integer,
  p_accessibility_requirements text, p_accessibility_visibility_consent boolean, p_climate text,
  p_visa_concern text, p_transport text, p_accommodation text, p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare caller_member public.trip_members%rowtype;
begin
  if p_idempotency_key is null then raise exception using errcode = '22023', message = 'Request identifier is required.'; end if;
  select member.* into caller_member from public.trip_members member where member.trip_id = p_trip_id and member.user_id = (select auth.uid()) and member.active;
  if caller_member.id is null then raise exception using errcode = '42501', message = 'Trip Room access is unavailable.'; end if;
  insert into public.member_constraints (member_id, trip_id, origin, starts_on, ends_on, date_flexibility_days, budget_min, budget_max, currency, max_travel_minutes, accessibility_requirements, accessibility_visibility_consent, climate, visa_concern, transport, accommodation)
  values (caller_member.id, p_trip_id, nullif(btrim(p_origin), ''), p_starts_on, p_ends_on, p_date_flexibility_days, p_budget_min, p_budget_max, upper(nullif(btrim(p_currency), '')), p_max_travel_minutes, nullif(btrim(p_accessibility_requirements), ''), coalesce(p_accessibility_visibility_consent, false), nullif(btrim(p_climate), ''), nullif(btrim(p_visa_concern), ''), nullif(btrim(p_transport), ''), nullif(btrim(p_accommodation), ''))
  on conflict (member_id) do update set origin = excluded.origin, starts_on = excluded.starts_on, ends_on = excluded.ends_on, date_flexibility_days = excluded.date_flexibility_days, budget_min = excluded.budget_min, budget_max = excluded.budget_max, currency = excluded.currency, max_travel_minutes = excluded.max_travel_minutes, accessibility_requirements = excluded.accessibility_requirements, accessibility_visibility_consent = excluded.accessibility_visibility_consent, climate = excluded.climate, visa_concern = excluded.visa_concern, transport = excluded.transport, accommodation = excluded.accommodation;
  return public.get_constraint_collection(p_trip_id);
end; $$;

create or replace function public.lock_constraint_collection(p_trip_id uuid, p_idempotency_key uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare target_trip public.trips%rowtype;
begin
  if p_idempotency_key is null then raise exception using errcode = '22023', message = 'Request identifier is required.'; end if;
  if not (select private.is_trip_organizer(p_trip_id)) then raise exception using errcode = '42501', message = 'Only the organiser can lock constraints.'; end if;
  select trip.* into target_trip from public.trips trip where trip.id = p_trip_id for update;
  if target_trip.constraints_locked_at is null and exists (select 1 from public.trip_members member where member.trip_id = p_trip_id and member.active and not exists (select 1 from public.member_constraints constraint_row where constraint_row.member_id = member.id)) then
    raise exception using errcode = '22023', message = 'Every active member must submit constraints before collection can be locked.';
  end if;
  if target_trip.constraints_locked_at is null then
    update public.invites set revoked_at = now() where trip_id = p_trip_id and revoked_at is null;
    update public.trips set constraints_locked_at = now(), updated_at = now() where id = p_trip_id;
  end if;
  return public.get_constraint_collection(p_trip_id);
end; $$;

create or replace function private.broadcast_constraint_change() returns trigger language plpgsql security definer set search_path = '' as $$
begin perform realtime.send(jsonb_build_object('entity', 'constraint', 'memberId', new.member_id), 'lobby_changed', 'trip:' || new.trip_id::text || ':lobby', true); return null; end; $$;
create trigger member_constraints_broadcast after insert or update on public.member_constraints for each row execute function private.broadcast_constraint_change();

revoke all on function public.get_constraint_collection(uuid) from public, anon;
revoke all on function public.save_member_constraints(uuid, text, date, date, smallint, numeric, numeric, text, integer, text, boolean, text, text, text, text, uuid) from public, anon;
revoke all on function public.lock_constraint_collection(uuid, uuid) from public, anon;
grant execute on function public.get_constraint_collection(uuid) to authenticated;
grant execute on function public.save_member_constraints(uuid, text, date, date, smallint, numeric, numeric, text, integer, text, boolean, text, text, text, text, uuid) to authenticated;
grant execute on function public.lock_constraint_collection(uuid, uuid) to authenticated;
