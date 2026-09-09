-- One canonical AI recommendation for identical inputs, shared across trip members.
create table public.trip_budget_recommendations (
  trip_id uuid not null references public.trips(id) on delete cascade,
  cache_key text not null check (cache_key ~ '^[a-f0-9]{64}$'),
  departure text not null,
  options jsonb not null,
  estimate jsonb not null,
  created_at timestamptz not null default now(),
  primary key (trip_id, cache_key)
);
alter table public.trip_budget_recommendations enable row level security;
revoke all on public.trip_budget_recommendations from anon, authenticated;
grant select, insert on public.trip_budget_recommendations to service_role;
-- Only the authenticated edge function may publish a shared AI result.
