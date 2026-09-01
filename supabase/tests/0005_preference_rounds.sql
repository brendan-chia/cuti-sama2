begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

select has_table('public', 'preference_rounds', 'preference rounds are persisted');
select has_table('public', 'preference_round_participants', 'active-member snapshots are persisted');
select has_table('public', 'preference_submissions', 'preference cards are separate from constraints');

insert into auth.users (instance_id, id, aud, role, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', now(), now());
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select lives_ok($$select public.create_trip('Preference room', 'destination_locked', array['Langkawi'], null, null, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$, 'organizer creates trip');
reset role;
create temporary table room_trip as select id from public.trips limit 1;
insert into public.trip_members (trip_id, user_id, display_name, role) values
  ((select id from room_trip), '22222222-2222-4222-8222-222222222222', 'Aina', 'member'),
  ((select id from room_trip), '33333333-3333-4333-8333-333333333333', 'Ben', 'member'),
  ((select id from room_trip), '44444444-4444-4444-8444-444444444444', 'Chen', 'member');
update public.trips set planning_started_at = now(), constraints_locked_at = now() where id = (select id from room_trip);
create temporary table room_members as select id, user_id from public.trip_members where trip_id = (select id from room_trip);
grant select on room_trip, room_members to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select lives_ok(format($$select public.manage_preference_round(%L, 'start', %L)$$, (select id from room_trip), 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 'organizer starts vibe round');
reset role;
create temporary table vibe_round as select id from public.preference_rounds where sequence = 1;
grant select on vibe_round to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select is((select count(*)::integer from public.preference_round_participants where round_id = (select id from vibe_round)), 4, 'round snapshots four active members');
select lives_ok(format($$select public.submit_preference_card(%L, %L, 'Slow mornings', %L)$$, (select id from room_trip), (select id from vibe_round), 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'), 'client one submits');

select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select is((select count(*)::integer from public.preference_submissions where member_id = (select id from room_members where user_id = '11111111-1111-4111-8111-111111111111')), 0, 'RLS hides another member hidden card through direct query');
select is(jsonb_array_length(public.get_preference_room((select id from room_trip))->'currentRound'->'revealedSubmissions'), 0, 'room RPC does not expose hidden cards');
select lives_ok(format($$select public.submit_preference_card(%L, %L, 'Night markets', %L)$$, (select id from room_trip), (select id from vibe_round), 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'), 'client two submits');
select lives_ok(format($$select public.submit_preference_card(%L, %L, 'Food and music', %L)$$, (select id from room_trip), (select id from vibe_round), 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'), 'client two changes card before reveal');
select is((select value from public.preference_submissions), 'Food and music', 'member reads the changed own card while blind');

select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
select lives_ok(format($$select public.submit_preference_card(%L, %L, 'Nature first', %L)$$, (select id from room_trip), (select id from vibe_round), 'ffffffff-ffff-4fff-8fff-ffffffffffff'), 'client three submits');
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}', true);
select lives_ok(format($$select public.submit_preference_card(%L, %L, 'Late nights', %L)$$, (select id from room_trip), (select id from vibe_round), '12121212-1212-4212-8212-121212121212'), 'fourth concurrent client submission succeeds');
select is((public.get_preference_room((select id from room_trip))->'currentRound'->>'status'), 'revealed', 'fourth submission automatically reveals');
select is(jsonb_array_length(public.get_preference_room((select id from room_trip))->'currentRound'->'revealedSubmissions'), 4, 'all four clients receive the same revealed card set');
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select is((public.get_preference_room((select id from room_trip))->'currentRound'->>'submittedCount')::integer, 4, 'client one agrees on ready state');
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select is((public.get_preference_room((select id from room_trip))->'currentRound'->>'status'), 'revealed', 'client two agrees on reveal state');
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
select is(jsonb_array_length(public.get_preference_room((select id from room_trip))->'currentRound'->'revealedSubmissions'), 4, 'client three agrees on card state');
select throws_ok(format($$select public.submit_preference_card(%L, %L, 'Too late', %L)$$, (select id from room_trip), (select id from vibe_round), '13131313-1313-4313-8313-131313131313'), '22023', 'This preference round has already been revealed.', 'cards cannot change after reveal');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select lives_ok(format($$select public.manage_preference_round(%L, 'close', %L)$$, (select id from room_trip), '14141414-1414-4414-8414-141414141414'), 'organizer closes revealed round');
select lives_ok(format($$select public.manage_preference_round(%L, 'advance', %L)$$, (select id from room_trip), '15151515-1515-4515-8515-151515151515'), 'organizer opens pace round');
reset role;
create temporary table pace_round as select id from public.preference_rounds where sequence = 2;
grant select on pace_round to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select lives_ok(format($$select public.submit_preference_card(%L, %L, 'Balanced', %L)$$, (select id from room_trip), (select id from pace_round), '16161616-1616-4616-8616-161616161616'), 'organizer submits pace');
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select lives_ok(format($$select public.submit_preference_card(%L, %L, 'Relaxed', %L)$$, (select id from room_trip), (select id from pace_round), '17171717-1717-4717-8717-171717171717'), 'second client submits pace');
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
select lives_ok(format($$select public.submit_preference_card(%L, %L, 'Full days', %L)$$, (select id from room_trip), (select id from pace_round), '18181818-1818-4818-8818-181818181818'), 'third client submits pace');
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select lives_ok(format($$select public.remove_trip_member(%L, %L, %L)$$, (select id from room_trip), (select id from room_members where user_id = '44444444-4444-4444-8444-444444444444'), '19191919-1919-4919-8919-191919191919'), 'organizer removes pending fourth member');
select is((public.get_preference_room((select id from room_trip))->'currentRound'->>'status'), 'revealed', 'removing pending snapshot member triggers reveal');
select is((public.get_preference_room((select id from room_trip))->'currentRound'->>'participantCount')::integer, 3, 'all clients agree on active snapshot after removal');
select is((public.get_preference_room((select id from room_trip))->'currentRound'->>'submittedCount')::integer, 3, 'all clients agree on ready count after removal');
select ok(not exists (select 1 from realtime.messages where topic = 'trip:' || (select id from room_trip)::text || ':lobby' and payload::text like '%Slow mornings%'), 'realtime payloads never contain card values');
select ok(not has_table_privilege('authenticated', 'public.preference_submissions', 'insert'), 'clients cannot bypass submission RPC writes');
select ok(not has_function_privilege('anon', 'public.get_preference_room(uuid)', 'execute'), 'anonymous users cannot inspect preference rounds');

select * from finish();
rollback;
