begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

select ok((select relrowsecurity from pg_class where oid = 'public.trips'::regclass), 'trips has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.trip_members'::regclass), 'trip_members has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.trip_destinations'::regclass), 'trip_destinations has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.request_idempotency'::regclass), 'idempotency records have RLS enabled');

insert into auth.users (instance_id, id, aud, role, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', now(), now());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select lives_ok($$select public.create_trip('Langkawi long weekend', 'destination_locked', array['Langkawi'], null, null, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$, 'an authenticated anonymous member can create a trip');
select lives_ok($$select public.create_trip('Langkawi long weekend', 'destination_locked', array['Langkawi'], null, null, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$, 'repeating the idempotency key returns safely');

reset role;
select is((select count(*)::integer from public.trips), 1, 'idempotent retry creates one trip');
select is((select count(*)::integer from public.trip_members where role = 'organizer'), 1, 'trip has one organizer');
select is((select count(*)::integer from public.trip_destinations), 1, 'locked destination is stored');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select is((select count(*)::integer from public.trips), 0, 'a non-member cannot read the trip');
select * from finish();
rollback;
