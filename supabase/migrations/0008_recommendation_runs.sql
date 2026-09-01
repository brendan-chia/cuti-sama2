+create type public.recommendation_run_status as enum ('matched', 'blocked');

create table public.recommendation_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  status public.recommendation_run_status not null,
  input_fingerprint text not null check (char_length(input_fingerprint) = 64),
  deterministic_result jsonb not null,
  ai_wording jsonb,
  created_at timestamptz not null default now(),
  unique (trip_id, input_fingerprint)
);

create index recommendation_runs_trip_created_idx on public.recommendation_runs (trip_id, created_at desc);
alter table public.recommendation_runs enable row level security;
revoke all on public.recommendation_runs from anon, authenticated;
grant select on public.recommendation_runs to authenticated;

create policy "Active members can read recommendation runs"
  on public.recommendation_runs for select to authenticated
  using ((select private.is_active_trip_member(trip_id)));


