begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

select has_table('public', 'itinerary_generation_operations', 'generation operations are persisted');
select has_table('public', 'itinerary_versions', 'schema-valid versions are persisted');
select col_is_unique('public', 'itinerary_versions', 'operation_id', 'one operation can create only one version');

insert into auth.users (instance_id, id, aud, role, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '99999999-9999-4999-8999-999999999999', 'authenticated', 'authenticated', now(), now());
set local role authenticated;
select set_config('request.jwt.claim.sub', '99999999-9999-4999-8999-999999999999', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select public.create_trip('Itinerary trip', 'destination_locked', array['Penang'], '2026-10-10', '2026-10-10', '99999999-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
reset role;
create temporary table itinerary_trip as select trip.id from public.trips trip where trip.name = 'Itinerary trip';
update public.trips set locked_destination_option_id = 'penang', locked_destination_name = 'Penang', locked_destination_country = 'Malaysia', destination_locked_at = '2026-09-02T09:00:00Z', planning_phase = 'itinerary_planning' where id = (select id from itinerary_trip);
insert into public.itinerary_generation_operations (trip_id, requested_by, idempotency_key)
  select trip.id, member.id, '88888888-8888-4888-8888-888888888888' from itinerary_trip trip join public.trip_members member on member.trip_id = trip.id;
create temporary table itinerary_operation as select id from public.itinerary_generation_operations where trip_id = (select id from itinerary_trip);

select lives_ok(format($query$select public.store_generated_itinerary(%L, %L, %L, %L::jsonb, %L::jsonb)$query$,
  (select id from itinerary_operation), 'penang', '2026-09-02T09:00:00Z', '{"schemaVersion":"1.0","days":[{"dayNumber":1}]}', '{"source":"test"}'), 'validated function path stores a version');
select lives_ok(format($query$select public.store_generated_itinerary(%L, %L, %L, %L::jsonb, %L::jsonb)$query$,
  (select id from itinerary_operation), 'penang', '2026-09-02T09:00:00Z', '{"schemaVersion":"1.0","days":[{"dayNumber":1}]}', '{"source":"test"}'), 'retry safely returns the existing version');
select is((select count(*)::integer from public.itinerary_versions where trip_id = (select id from itinerary_trip)), 1, 'same operation never creates a duplicate version');
select is((select status::text from public.itinerary_generation_operations where id = (select id from itinerary_operation)), 'completed', 'operation completion is retained');

set local role authenticated;
select set_config('request.jwt.claim.sub', '99999999-9999-4999-8999-999999999999', true);
select is((public.get_itinerary_state((select id from itinerary_trip))->'latest'->>'version')::integer, 1, 'restart restoration returns the stored version');
select is(public.get_itinerary_state((select id from itinerary_trip))->'lockedDestination'->>'name', 'Penang', 'state retains the locked destination');
select ok(not has_table_privilege('authenticated', 'public.itinerary_versions', 'insert'), 'clients cannot write itinerary versions directly');
select ok(not has_function_privilege('authenticated', 'public.store_generated_itinerary(uuid,text,timestamptz,jsonb,jsonb)', 'execute'), 'clients cannot invoke the storage function');

select * from finish();
rollback;
