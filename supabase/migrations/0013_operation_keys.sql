create type public.operation_key_status as enum ('processing', 'completed');

create table public.operation_keys (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  operation text not null check (char_length(operation) between 1 and 80),
  idempotency_key uuid not null,
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  status public.operation_key_status not null default 'processing',
  response jsonb,
  response_status integer check (response_status is null or response_status between 100 and 599),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_user_id, operation, idempotency_key),
  check ((status = 'processing' and response is null and response_status is null) or (status = 'completed' and response is not null and response_status is not null))
);

alter table public.operation_keys enable row level security;
revoke all on public.operation_keys from anon, authenticated;
grant select, insert, update, delete on public.operation_keys to service_role;
create index operation_keys_expiry_idx on public.operation_keys (updated_at) where status = 'processing';
