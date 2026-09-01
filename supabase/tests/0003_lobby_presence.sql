begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

select has_column('public', 'trip_members', 'lobby_ready', 'member readiness is persisted');
select has_column('public', 'trips', 'planning_started_at', 'planning start is persisted');

insert into auth.users (instance_id, id, aud, role, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', now(), now());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select lives_ok($$select public.create_trip('Langkawi weekend', 'destination_locked', array['Langkawi'], null, null, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$, 'organizer creates a room');

reset role;
create temporary table test_trip as select id from public.trips limit 1;
grant select on test_trip to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select is((public.get_trip_lobby((select id from test_trip))->'members'->0->>'role'), 'organizer', 'lobby identifies the organizer');
select lives_ok(format($$select public.manage_invite(%L, 'issue', %L, now() + interval '30 days', %L)$$, (select id from test_trip), repeat('a', 64), 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 'organizer opens joining');

select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select is((public.join_trip(repeat('a', 64), 'Aina', false, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')->>'status'), 'joined', 'guest joins the lobby');
select is(jsonb_array_length(public.get_trip_lobby((select id from test_trip))->'members'), 2, 'both active members appear');
select throws_ok(format($$select public.start_trip_planning(%L, %L)$$, (select id from test_trip), 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'), '42501', 'Only the organiser can start planning.', 'member cannot start planning');
select lives_ok(format($$select public.set_lobby_ready(%L, true, %L)$$, (select id from test_trip), 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'), 'member can persist readiness');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select throws_ok(format($$select public.start_trip_planning(%L, %L)$$, (select id from test_trip), 'ffffffff-ffff-4fff-8fff-ffffffffffff'), '22023', 'Every active member must be ready before planning can begin.', 'start explains incomplete readiness');
select lives_ok(format($$select public.set_lobby_ready(%L, true, %L)$$, (select id from test_trip), '12121212-1212-4212-8212-121212121212'), 'organizer can persist readiness');
select lives_ok(format($$select public.start_trip_planning(%L, %L)$$, (select id from test_trip), '13131313-1313-4313-8313-131313131313'), 'all-ready lobby can start');
select ok((public.get_trip_lobby((select id from test_trip))->>'startedAt') is not null, 'all members see the persisted start');

reset role;
create temporary table guest_member as select id from public.trip_members where role = 'member' limit 1;
grant select on guest_member to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select lives_ok(format($$select public.remove_trip_member(%L, %L, %L)$$, (select id from test_trip), (select id from guest_member), '14141414-1414-4414-8414-141414141414'), 'organizer removes a member');
select is(jsonb_array_length(public.get_trip_lobby((select id from test_trip))->'members'), 1, 'removed member leaves the active roster');

select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select throws_ok(format($$select public.get_trip_lobby(%L)$$, (select id from test_trip)), '42501', 'Trip Room access is unavailable.', 'removed member loses read access');
select ok(not (select private.can_access_lobby_topic('trip:' || (select id from test_trip)::text || ':lobby')), 'removed member loses realtime authorization');

reset role;
select ok(not has_function_privilege('anon', 'public.get_trip_lobby(uuid)', 'execute'), 'unauthenticated visitors cannot execute lobby RPCs');
select ok(not exists (select 1 from realtime.messages where topic = 'trip:' || (select id from test_trip)::text || ':lobby' and payload ? 'userId'), 'realtime payloads do not expose auth user IDs');

select * from finish();
rollback;
