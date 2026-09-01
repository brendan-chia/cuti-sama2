create table public.destination_catalogue (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  country text not null check (char_length(btrim(country)) between 1 and 120),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  enabled boolean not null default false,
  estimate_currency text check (estimate_currency is null or estimate_currency ~ '^[A-Z]{3}$'),
  estimate_min numeric(12,2) check (estimate_min >= 0),
  estimate_max numeric(12,2) check (estimate_max >= 0),
  estimate_status text not null check (estimate_status in ('verified', 'estimated', 'unavailable')),
  travel_times jsonb not null default '[]'::jsonb check (jsonb_typeof(travel_times) = 'array'),
  interests text[] not null default '{}',
  climate_tags text[] not null default '{}',
  visa_tags text[] not null default '{}',
  accessibility_tags text[] not null default '{}',
  transport_tags text[] not null default '{}',
  accommodation_tags text[] not null default '{}',
  primary_compromise text not null check (char_length(btrim(primary_compromise)) between 1 and 240),
  evidence jsonb not null check (jsonb_typeof(evidence) = 'object'),
  evidence_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint complete_estimate check (
    (estimate_min is null and estimate_max is null and estimate_currency is null and estimate_status = 'unavailable') or
    (estimate_min is not null and estimate_max is not null and estimate_currency is not null and estimate_max >= estimate_min and estimate_status <> 'unavailable')
  )
);

create unique index destination_catalogue_name_country_idx on public.destination_catalogue (lower(name), lower(country));
create index destination_catalogue_enabled_idx on public.destination_catalogue (enabled, name);

create table public.destination_recommendation_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  mode public.planning_mode not null,
  input_fingerprint text not null check (char_length(input_fingerprint) = 64),
  deterministic_result jsonb not null,
  ai_annotations jsonb,
  created_at timestamptz not null default now(),
  unique (trip_id, input_fingerprint)
);

create index destination_recommendation_runs_trip_idx on public.destination_recommendation_runs (trip_id, created_at desc);
alter table public.destination_catalogue enable row level security;
alter table public.destination_recommendation_runs enable row level security;
revoke all on public.destination_catalogue, public.destination_recommendation_runs from anon, authenticated;
grant select on public.destination_catalogue, public.destination_recommendation_runs to authenticated;

create policy "Authenticated members can read enabled catalogue destinations"
  on public.destination_catalogue for select to authenticated using (enabled);
create policy "Active members can read destination recommendation runs"
  on public.destination_recommendation_runs for select to authenticated
  using ((select private.is_active_trip_member(trip_id)));

