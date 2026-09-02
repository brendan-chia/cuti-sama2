begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

select has_table('public', 'itinerary_revision_operations', 'revision operations are persisted');
select has_column('public', 'trips', 'active_itinerary_version_id', 'trip has an optimistic active-version pointer');

insert into auth.users (instance_id, id, aud, role, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '10101010-1010-4010-8010-101010101010', 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '20202020-2020-4020-8020-202020202020', 'authenticated', 'authenticated', now(), now());
set local role authenticated;
select set_config('request.jwt.claim.sub', '10101010-1010-4010-8010-101010101010', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select public.create_trip('Revision trip', 'destination_locked', array['Penang'], '2026-10-10', '2026-10-10', '30303030-3030-4030-8030-303030303030');
reset role;
create temporary table revision_trip as select trip.id from public.trips trip where trip.name = 'Revision trip';
update public.trips set locked_destination_option_id = 'penang', locked_destination_name = 'Penang', locked_destination_country = 'Malaysia', destination_locked_at = '2026-09-02T09:00:00Z', planning_phase = 'itinerary_planning' where id = (select id from revision_trip);
insert into public.trip_members (trip_id, user_id, display_name, role) values ((select id from revision_trip), '20202020-2020-4020-8020-202020202020', 'Member', 'member');
insert into public.itinerary_generation_operations (trip_id, requested_by, idempotency_key) select trip.id, member.id, '40404040-4040-4040-8040-404040404040' from revision_trip trip join public.trip_members member on member.trip_id = trip.id and member.role = 'organizer';
select public.store_generated_itinerary((select id from public.itinerary_generation_operations where trip_id = (select id from revision_trip)), 'penang', '2026-09-02T09:00:00Z', '{"schemaVersion":"1.0","days":[{"dayNumber":1}]}'::jsonb, '{"source":"test"}'::jsonb);
create temporary table v1 as select id from public.itinerary_versions where trip_id = (select id from revision_trip) and version_number = 1;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10101010-1010-4010-8010-101010101010', true);
select lives_ok(format($q$select public.begin_itinerary_revision(%L,%L,%L,'{"kind":"pace","pace":"relaxed"}'::jsonb)$q$, (select id from revision_trip), (select id from v1), '50505050-5050-4050-8050-505050505050'), 'organiser begins a bounded revision');
select throws_ok(format($q$select public.begin_itinerary_revision(%L,%L,%L,'{"kind":"budget_cap","amount":500,"currency":"MYR"}'::jsonb)$q$, (select id from revision_trip), (select id from v1), '60606060-6060-4060-8060-606060606060'), 'P0003', 'VERSION_CONFLICT', 'simultaneous revision from the same base loses optimistically');
reset role;
create temporary table revision_operation as select id from public.itinerary_revision_operations where idempotency_key = '50505050-5050-4050-8050-505050505050';
select lives_ok(format($q$select public.store_revised_itinerary(%L,'{"schemaVersion":"1.0","days":[{"dayNumber":1}]}'::jsonb,'{"changedDays":[{"dayNumber":1}],"beforeEstimate":{"currency":"MYR","minimum":20,"maximum":30},"afterEstimate":{"currency":"MYR","minimum":10,"maximum":20}}'::jsonb)$q$, (select id from revision_operation)), 'service stores immutable revision candidate');
select is((select max(version_number) from public.itinerary_versions where trip_id = (select id from revision_trip)), 2, 'versions sequence monotonically');
select is((select count(*)::integer from public.itinerary_versions where trip_id = (select id from revision_trip)), 2, 'previous version remains recoverable');
create temporary table v2 as select id from public.itinerary_versions where trip_id = (select id from revision_trip) and version_number = 2;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10101010-1010-4010-8010-101010101010', true);
select lives_ok(format('select public.activate_itinerary_version(%L,%L,%L)', (select id from revision_trip), (select id from v2), (select id from v1)), 'organiser activates the accepted revision');
select is(public.get_itinerary_revision_state((select id from revision_trip))->'active'->>'version', '2', 'restart restores latest locked version');
select is(jsonb_array_length(public.get_itinerary_revision_state((select id from revision_trip))->'history'), 2, 'restart restores full history');
select lives_ok(format('select public.activate_itinerary_version(%L,%L,%L)', (select id from revision_trip), (select id from v1), (select id from v2)), 'organiser can recover a previous immutable version');
select is(public.get_itinerary_revision_state((select id from revision_trip))->'active'->>'version', '1', 'restored version becomes active');

select set_config('request.jwt.claim.sub', '20202020-2020-4020-8020-202020202020', true);
select lives_ok(format('select public.get_itinerary_revision_state(%L)', (select id from revision_trip)), 'member can read shared version history');
select throws_ok(format($q$select public.begin_itinerary_revision(%L,%L,%L,'{"kind":"pace","pace":"full"}'::jsonb)$q$, (select id from revision_trip), (select id from v1), '70707070-7070-4070-8070-707070707070'), '42501', 'Only the organiser can revise the itinerary.', 'member cannot revise through the API');
select throws_ok(format('select public.activate_itinerary_version(%L,%L,%L)', (select id from revision_trip), (select id from v2), (select id from v1)), '42501', 'Only the organiser can activate itinerary versions.', 'member cannot activate through the API');
select ok(not has_table_privilege('authenticated', 'public.itinerary_versions', 'insert'), 'members cannot insert itinerary records directly');
select ok(not has_table_privilege('authenticated', 'public.itinerary_versions', 'update'), 'members cannot update itinerary records directly');
select ok(not has_table_privilege('authenticated', 'public.itinerary_versions', 'delete'), 'members cannot delete itinerary records directly');
select ok(not has_function_privilege('authenticated', 'public.store_revised_itinerary(uuid,jsonb,jsonb)', 'execute'), 'members cannot invoke revision storage directly');

select * from finish();
rollback;
