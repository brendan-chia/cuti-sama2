-- Preserve the exact planning alternatives used to calculate each traveller's budget.
create table public.trip_budget_basis (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  context text not null,
  departure text not null,
  options jsonb not null,
  estimate jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);
alter table public.trip_budget_basis enable row level security;
revoke all on public.trip_budget_basis from anon, authenticated;
grant select, insert, update on public.trip_budget_basis to authenticated;
create policy "Own trip budget basis" on public.trip_budget_basis for all to authenticated
using (user_id = (select auth.uid()) and private.is_active_trip_member(trip_id))
with check (user_id = (select auth.uid()) and private.is_active_trip_member(trip_id));
