begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

select has_table('public', 'member_constraints', 'constraints are stored separately from preferences');
select has_column('public', 'trips', 'constraints_locked_at', 'collection lock is persisted');

insert into auth.users (instance_id, id, aud, role, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', now(), now());
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select lives_ok($$select public.create_trip('Anywhere together', 'undecided', array[]::text[], null, null, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$, 'organizer creates undecided trip');
reset role;
create temporary table constraint_trip as select id from public.trips limit 1;
create temporary table organizer_member as select id from public.trip_members where role = 'organizer' limit 1;
update public.trips set planning_started_at = now() where id = (select id from constraint_trip);
grant select on constraint_trip, organizer_member to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select lives_ok(format($$select public.save_member_constraints(%L, 'Kuala Lumpur', '2027-01-10', '2027-01-17', 0, 500, 1500, 'MYR', 480, 'None', true, 'Warm', null, 'No overnight bus', null, %L)$$, (select id from constraint_trip), 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 'member submits valid undecided constraints');
select throws_like(format($$select public.save_member_constraints(%L, 'Kuala Lumpur', '2027-01-17', '2027-01-10', 0, 500, 1500, 'MYR', 480, 'None', true, null, null, null, null, %L)$$, (select id from constraint_trip), 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'), '%valid_constraint_dates%', 'inverted dates are rejected');
select throws_like(format($$select public.save_member_constraints(%L, 'Kuala Lumpur', '2027-01-10', '2027-01-17', 0, 0, 1500, 'MYR', 480, 'None', true, null, null, null, null, %L)$$, (select id from constraint_trip), 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'), '%member_constraints_budget_min_check%', 'zero budget is rejected');
select is((select count(*)::integer from public.member_constraints), 1, 'member reads own constraint row');
select lives_ok(format($$update public.member_constraints set climate = 'Humid' where member_id = %L$$, (select id from organizer_member)), 'member can edit own constraint before lock');

reset role;
insert into public.trip_members (trip_id, user_id, display_name, role) values ((select id from constraint_trip), '22222222-2222-4222-8222-222222222222', 'Aina', 'member');
create temporary table guest_member as select id from public.trip_members where user_id = '22222222-2222-4222-8222-222222222222';
grant select on guest_member to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select is((select count(*)::integer from public.member_constraints), 0, 'cross-member constraint details are hidden by RLS');
select lives_ok(format($$update public.member_constraints set origin = 'Changed' where member_id = %L$$, (select id from organizer_member)), 'cross-member update is safely filtered by RLS');

select lives_ok(format($$select public.save_member_constraints(%L, 'Penang', '2027-01-10', '2027-01-17', 2, 600, 1600, 'MYR', 360, 'None', true, null, null, null, null, %L)$$, (select id from constraint_trip), 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'), 'second member submits own constraints');
select is((public.get_constraint_collection((select id from constraint_trip))->>'canLock')::boolean, true, 'completion makes lock eligible immediately');
select throws_ok(format($$select public.lock_constraint_collection(%L, %L)$$, (select id from constraint_trip), 'ffffffff-ffff-4fff-8fff-ffffffffffff'), '42501', 'Only the organiser can lock constraints.', 'member cannot lock');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select lives_ok(format($$select public.lock_constraint_collection(%L, %L)$$, (select id from constraint_trip), '12121212-1212-4212-8212-121212121212'), 'organizer locks a complete collection');
select ok((public.get_constraint_collection((select id from constraint_trip))->>'lockedAt') is not null, 'lock is visible in collection state');
select throws_ok(format($$update public.member_constraints set origin = 'Race edit' where member_id = %L$$, (select id from organizer_member)), '22023', 'Constraint collection is locked.', 'edit losing the lock/edit race is rejected');
select is((select origin from public.member_constraints where member_id = (select id from organizer_member)), 'Kuala Lumpur', 'locked value remains unchanged');
select ok(not has_function_privilege('anon', 'public.get_constraint_collection(uuid)', 'execute'), 'anonymous users cannot read constraint collection');

select * from finish();
rollback;
