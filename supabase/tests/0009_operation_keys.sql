begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

select has_table('public', 'operation_keys', 'operation keys are persisted centrally');
select col_is_pk('public', 'operation_keys', array['owner_user_id', 'operation', 'idempotency_key'], 'operation identity is unique per guest and mutation');
select has_column('public', 'operation_keys', 'request_hash', 'same key cannot be reused for a different payload');
select has_column('public', 'operation_keys', 'response', 'completed responses are replayable');
select ok(not has_table_privilege('authenticated', 'public.operation_keys', 'select'), 'clients cannot inspect operation records');
select ok(not has_table_privilege('authenticated', 'public.operation_keys', 'insert'), 'clients cannot forge operation records');

insert into auth.users (instance_id, id, aud, role, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '81818181-8181-4181-8181-818181818181', 'authenticated', 'authenticated', now(), now());
insert into public.operation_keys (owner_user_id, operation, idempotency_key, request_hash)
values ('81818181-8181-4181-8181-818181818181', 'submit-card', '82828282-8282-4282-8282-828282828282', repeat('a', 64));
insert into public.operation_keys (owner_user_id, operation, idempotency_key, request_hash)
values ('81818181-8181-4181-8181-818181818181', 'submit-card', '82828282-8282-4282-8282-828282828282', repeat('a', 64)) on conflict do nothing;
select is((select count(*)::integer from public.operation_keys), 1, 'duplicate submission key creates one operation');
select throws_ok($q$insert into public.operation_keys (owner_user_id, operation, idempotency_key, request_hash) values ('81818181-8181-4181-8181-818181818181', 'submit-card', '82828282-8282-4282-8282-828282828282', repeat('b', 64))$q$, '23505', null, 'same key with changed payload conflicts');

select ok(exists (select 1 from pg_constraint where conrelid = 'public.request_idempotency'::regclass and contype = 'p'), 'create operation keys are unique');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.preference_submissions'::regclass and contype = 'p'), 'card submissions cannot duplicate a member-round record');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.destination_votes'::regclass and contype = 'p'), 'votes cannot duplicate a member-round record');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.itinerary_generation_operations'::regclass and contype = 'u' and pg_get_constraintdef(oid) like '%trip_id, idempotency_key%'), 'generate operations have unique trip keys');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.itinerary_revision_operations'::regclass and contype = 'u' and pg_get_constraintdef(oid) like '%trip_id, idempotency_key%'), 'revise operations have unique trip keys');

select * from finish();
rollback;
