begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

select has_table('public', 'destination_vote_rounds', 'vote rounds are persisted');
select has_table('public', 'destination_vote_participants', 'active voter snapshots are persisted');
select has_table('public', 'destination_votes', 'ballots are persisted separately');
select has_pk('public', 'destination_votes', 'one vote row exists per member and round');

insert into auth.users (instance_id, id, aud, role, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', now(), now());
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select public.create_trip('Voting trip', 'shortlist', array['Penang', 'Da Nang'], null, null, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
create temporary table vote_trip as select trip.id from public.trips trip where trip.name = 'Voting trip';
reset role;
update public.trip_members set display_name = case user_id when '11111111-1111-4111-8111-111111111111' then 'Organiser' else 'Member' end;
insert into public.trip_members (trip_id, user_id, display_name, role) select id, '22222222-2222-4222-8222-222222222222', 'Member', 'member' from vote_trip;
insert into public.trip_members (trip_id, user_id, display_name, role) select id, '33333333-3333-4333-8333-333333333333', 'Member', 'member' from vote_trip;
insert into public.trip_members (trip_id, user_id, display_name, role) select id, '44444444-4444-4444-8444-444444444444', 'Member', 'member' from vote_trip;
insert into public.destination_recommendation_runs (trip_id, mode, input_fingerprint, deterministic_result)
select id, 'shortlist', repeat('a', 64), jsonb_build_object('destinations', jsonb_build_array(
  jsonb_build_object('destinationId', 'penang', 'name', 'Penang', 'country', 'Malaysia', 'eligible', true, 'excludedBy', '[]'::jsonb, 'matchReasons', '["Good fit"]'::jsonb, 'confidence', '{"level":"high"}'::jsonb),
  jsonb_build_object('destinationId', 'danang', 'name', 'Da Nang', 'country', 'Vietnam', 'eligible', true, 'excludedBy', '[]'::jsonb, 'matchReasons', '[]'::jsonb, 'confidence', '{"level":"medium"}'::jsonb)
)) from vote_trip;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select lives_ok(format('select public.manage_destination_vote(%L, %L, %L)', (select id from vote_trip), 'start', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 'organiser starts voting');
select is((public.get_destination_vote_room((select id from vote_trip))->'round'->>'participantCount')::integer, 4, 'all four active members are snapshotted');
select is(public.get_destination_vote_room((select id from vote_trip))->'round'->'totals', null::jsonb, 'totals are hidden while open');

create temporary table vote_round as select id from public.destination_vote_rounds where trip_id = (select id from vote_trip);
select lives_ok(format('select public.submit_destination_vote(%L, %L, %L, %L)', (select id from vote_trip), (select id from vote_round), 'penang', 'c1111111-1111-4111-8111-111111111111'), 'organiser votes');
select lives_ok(format('select public.submit_destination_vote(%L, %L, %L, %L)', (select id from vote_trip), (select id from vote_round), 'danang', 'c1111111-1111-4111-8111-111111111112'), 'organiser changes only their own open vote');
select is((select count(*)::integer from public.destination_votes where round_id = (select id from vote_round)), 1, 'vote change does not add a second ballot');
select is((select option_id from public.destination_votes where round_id = (select id from vote_round)), 'danang', 'own open vote is updated');

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select lives_ok(format('select public.submit_destination_vote(%L, %L, %L, %L)', (select id from vote_trip), (select id from vote_round), 'penang', 'c2222222-2222-4222-8222-222222222222'), 'second client votes');
select is((select count(*)::integer from public.destination_votes), 1, 'open-vote RLS hides another member ballot');
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select lives_ok(format('select public.submit_destination_vote(%L, %L, %L, %L)', (select id from vote_trip), (select id from vote_round), 'danang', 'c3333333-3333-4333-8333-333333333333'), 'third client votes');
select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
select lives_ok(format('select public.submit_destination_vote(%L, %L, %L, %L)', (select id from vote_trip), (select id from vote_round), 'penang', 'c4444444-4444-4444-8444-444444444444'), 'last client vote atomically closes');
select is((public.get_destination_vote_room((select id from vote_trip))->'round'->>'status'), 'tied', 'two-two vote remains an explicit tie');
select is((public.get_destination_vote_room((select id from vote_trip))->'round'->'totals')::text, '[{"total": 2, "optionId": "penang"}, {"total": 2, "optionId": "danang"}]', 'closed totals are identical and ordered');
select is((select count(*)::integer from public.destination_votes), 4, 'closed-vote RLS reveals all four ballots');
select throws_ok(format('select public.submit_destination_vote(%L, %L, %L, %L)', (select id from vote_trip), (select id from vote_round), 'danang', 'd4444444-4444-4444-8444-444444444444'), '22023', 'Voting is already closed.', 'vote change loses a close race cleanly');

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select lives_ok(format('select public.manage_destination_vote(%L, %L, %L)', (select id from vote_trip), 'second_vote', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'), 'tie can open a second vote');
select is((public.get_destination_vote_room((select id from vote_trip))->'round'->>'roundNumber')::integer, 2, 'second vote creates the next round');
select is(jsonb_array_length(public.get_destination_vote_room((select id from vote_trip))->'round'->'options'), 2, 'second vote contains tied finalists only');

reset role;
update public.destination_vote_rounds set status = 'tied', result_totals = '[{"optionId":"penang","total":2},{"optionId":"danang","total":2}]', tied_option_ids = array['penang','danang'], closed_at = now() where round_number = 2;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select lives_ok(format('select public.manage_destination_vote(%L, %L, %L)', (select id from vote_trip), 'constraint_comparison', 'ffffffff-ffff-4fff-8fff-ffffffffffff'), 'tie can use constraint comparison');
select is((public.get_destination_vote_room((select id from vote_trip))->'round'->>'winningOptionId'), 'penang', 'constraint comparison selects the unique recorded score leader');
select is((public.get_destination_vote_room((select id from vote_trip))->'round'->>'resolution'), 'constraint_comparison', 'constraint resolution is recorded');
select lives_ok(format('select public.set_locked_destination(%L, %L, %L, %L)', (select id from vote_trip), 'penang', 'lock', 'abababab-abab-4bab-8bab-abababababab'), 'organiser locks the recorded winner');
select is(public.get_destination_vote_room((select id from vote_trip))->>'phase', 'itinerary_planning', 'all clients enter itinerary planning');
select is(public.get_destination_vote_room((select id from vote_trip))->'lockedDestination'->>'name', 'Penang', 'locked destination is persisted');
select lives_ok(format('select public.set_locked_destination(%L, %L, %L, %L)', (select id from vote_trip), 'penang', 'unlock', 'acacacac-acac-4cac-8cac-acacacacacac'), 'organiser can explicitly unlock');
select is(public.get_destination_vote_room((select id from vote_trip))->>'phase', 'destination_voting', 'unlock returns to destination voting');
select ok(not has_table_privilege('authenticated', 'public.destination_votes', 'insert'), 'clients cannot bypass vote RPC writes');

select * from finish();
rollback;
