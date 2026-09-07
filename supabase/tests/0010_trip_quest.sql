begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select has_table('public', 'trip_quests', 'quest stages persist across devices');
select has_table('public', 'trip_quest_inputs', 'each participant has private persisted inputs');
select is((select count(*)::integer from public.trip_quest_attractions), 72, 'the server validates the same 72 map attractions');
select ok(not has_table_privilege('authenticated', 'public.trip_quests', 'update'), 'clients cannot skip stages through direct writes');
select ok(not has_table_privilege('authenticated', 'public.trip_quest_inputs', 'insert'), 'clients cannot inject another participant');
select ok(not has_function_privilege('anon', 'public.get_trip_quest(uuid)', 'execute'), 'anonymous callers cannot load a quest');
select ok(not has_function_privilege('authenticated', 'private.reconcile_trip_quest(uuid)', 'execute'), 'internal transition helper is not callable by clients');

insert into auth.users (instance_id, id, aud, role, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', now(), now());
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select public.create_trip('Trip quest test', 'undecided', '{}', null, null, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
create temporary table quest_test_trip as select id from public.trips where name = 'Trip quest test';
create function pg_temp.room() returns jsonb language sql as $$ select public.get_trip_quest((select id from quest_test_trip)); $$;
create function pg_temp.act(action jsonb, operation_key uuid default extensions.gen_random_uuid()) returns jsonb language sql as $$
  select public.update_trip_quest((select id from quest_test_trip), action, operation_key);
$$;
create function pg_temp.period_action(first_day integer, last_day integer) returns jsonb language sql as $$
  select jsonb_build_object('type', 'period', 'period', jsonb_build_object('startsOn', current_date + first_day, 'endsOn', current_date + last_day, 'label', 'A shared escape', 'reason', 'Within everyone’s available dates.'));
$$;
select throws_ok('select pg_temp.room()', '22023', 'Start planning in the lobby first.', 'quest cannot start before lobby planning');

reset role;
update public.trip_members set display_name = 'Host' where trip_id = (select id from quest_test_trip);
insert into public.trip_members(trip_id, user_id, display_name, role) select id, '22222222-2222-4222-8222-222222222222', 'Member Two', 'member' from quest_test_trip;
insert into public.trip_members(trip_id, user_id, display_name, role) select id, '33333333-3333-4333-8333-333333333333', 'Member Three', 'member' from quest_test_trip;
insert into public.invites(trip_id, token_hash, created_by_member_id, expires_at)
  select id, repeat('a', 64), organizer_member_id, now() + interval '1 day' from public.trips where id = (select id from quest_test_trip);
update public.trips set planning_started_at = now() where id = (select id from quest_test_trip);
set local role authenticated;
select is(pg_temp.room()->>'stage', 'timing', 'first load initializes the timing mission');
select is((pg_temp.room()->>'revision')::integer, 0, 'read-only reloads do not advance revision');
select is(jsonb_array_length(pg_temp.room()->'members'), 3, 'quest snapshots all three active participants');
select is((select count(*)::integer from public.trip_quest_inputs), 1, 'RLS exposes only the caller input row');
select is(pg_temp.room()->'dateProposals', '[]'::jsonb, 'proposals are hidden until everyone submits');
select throws_ok('select pg_temp.act(pg_temp.period_action(50,54))', '22023', 'Generate a fresh recommendation after everyone submits, then confirm one of its periods.', 'host cannot choose dates before everyone submits');

reset role;
select ok((select bool_and(revoked_at is not null) from public.invites where trip_id = (select id from quest_test_trip)), 'initializing the quest closes existing invitations');
select throws_ok('update public.invites set revoked_at = null where trip_id = (select id from quest_test_trip)',
  '22023', 'Invitations are closed while this trip is on its planning quest.', 'a revoked invitation cannot be reactivated during the quest');
select throws_ok($$insert into public.trip_members(trip_id, user_id, display_name, role) select id, '44444444-4444-4444-8444-444444444444', 'Late Join', 'member' from quest_test_trip$$,
  '22023', 'This trip has started its planning quest. Joining is closed.', 'a late member cannot join an in-progress snapshot');
set local role authenticated;
select throws_ok($$select public.manage_invite((select id from quest_test_trip), 'issue', repeat('b',64), now()+interval '1 day', extensions.gen_random_uuid())$$,
  '22023', 'Invitations are closed while this trip is on its planning quest.', 'the invitation API cannot issue a dead invitation after planning starts');
select throws_ok($$select public.manage_invite((select id from quest_test_trip), 'rotate', repeat('b',64), now()+interval '1 day', extensions.gen_random_uuid())$$,
  '22023', 'Invitations are closed while this trip is on its planning quest.', 'the invitation API cannot rotate and reopen the frozen participant list');
select is(public.manage_invite((select id from quest_test_trip), 'status', null, null, null)->>'status', 'closed', 'invitation status remains available and accurately reports closed');
select lives_ok($$select public.manage_invite((select id from quest_test_trip), 'close', null, null, extensions.gen_random_uuid())$$, 'closing invitations remains a safe idempotent action');
select is(public.get_trip_lobby((select id from quest_test_trip))->'joiningOpen', 'false'::jsonb, 'the lobby reports that joining is closed');
select throws_ok($$select pg_temp.act(jsonb_build_object('type','availability','startsOn',current_date,'endsOn',current_date+10))$$,
  '22023', 'Propose a future trip of 1–30 days within the next three years.', 'availability rejects today and past dates');
select throws_ok($$select pg_temp.act('{"type":"availability","startsOn":"2030-02-30","endsOn":"2030-03-02"}')$$,
  '22023', 'Enter valid proposed dates.', 'calendar-invalid dates are rejected');
select pg_temp.act(jsonb_build_object('type','availability','startsOn',current_date+50,'endsOn',current_date+54));
select is(pg_temp.room()->'dateProposals', '[]'::jsonb, 'one submission does not reveal proposals before the others submit');
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select is(pg_temp.room()->'ownAvailability', 'null'::jsonb, 'another member never sees the host private dates');
select pg_temp.act(jsonb_build_object('type','availability','startsOn',current_date+60,'endsOn',current_date+64));
select throws_ok('select pg_temp.act(pg_temp.period_action(50,54))', '42501', 'Only the organiser can advance this quest stage.', 'members cannot lock the trip period');
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select pg_temp.act(jsonb_build_object('type','availability','startsOn',current_date+70,'endsOn',current_date+74));
select is(jsonb_array_length(pg_temp.room()->'dateProposals'), 3, 'all three proposals are shared after everyone submits');
select is(pg_temp.room()->'sharedAvailability', 'null'::jsonb, 'proposals do not need to overlap');
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select throws_ok('select pg_temp.act(pg_temp.period_action(40,44))', '22023', 'Generate a fresh recommendation after everyone submits, then confirm one of its periods.', 'a period nobody proposed is rejected');
select throws_ok('select pg_temp.act(pg_temp.period_action(50,64))', '22023', 'Generate a fresh recommendation after everyone submits, then confirm one of its periods.', 'an altered proposal cannot be selected');
select throws_ok('select pg_temp.act(pg_temp.period_action(50,50))', '22023', 'Generate a fresh recommendation after everyone submits, then confirm one of its periods.', 'a truncated proposal cannot be selected');
reset role;
select public.save_date_recommendation((select id from quest_test_trip),
  (select organizer_member_id from public.trips where id = (select id from quest_test_trip)),
  (select revision from public.trip_quests where trip_id = (select id from quest_test_trip)),
  jsonb_build_object('calendarVersion', (select version from public.national_holiday_calendar where id = 1), 'periods', jsonb_build_array(pg_temp.period_action(50,54)->'period')));
set local role authenticated;
select pg_temp.act(pg_temp.period_action(50,54));
select is(pg_temp.room()->>'stage', 'picks', 'a valid shared period unlocks destination picks');
select throws_ok($$select pg_temp.act(jsonb_build_object('type','availability','startsOn',current_date+50,'endsOn',current_date+80))$$,
  '22023', 'Date proposals are locked after the trip period is chosen.', 'later changes cannot invalidate the chosen dates');
select throws_ok($$select pg_temp.act('{"type":"picks","countryCodes":[]}')$$, '22023', 'Choose one to three different supported countries.', 'at least one pick is required');
select throws_ok($$select pg_temp.act('{"type":"picks","countryCodes":["MY","MY"]}')$$, '22023', 'Choose one to three different supported countries.', 'duplicate picks are rejected');
select throws_ok($$select pg_temp.act('{"type":"picks","countryCodes":["MY","TH","JP","FR"]}')$$, '22023', 'Choose one to three different supported countries.', 'four picks are rejected');
select throws_ok($$select pg_temp.act('{"type":"picks","countryCodes":["XX"]}')$$, '22023', 'Choose one to three different supported countries.', 'unsupported countries cannot enter the ballot');
select pg_temp.act('{"type":"picks","countryCodes":["MY","TH"]}');
select is(pg_temp.room()->'countries', '[]'::jsonb, 'group picks stay hidden before all submissions');
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select is(pg_temp.room()->'ownPicks', '[]'::jsonb, 'the second member sees only their own picks');
select pg_temp.act('{"type":"picks","countryCodes":["TH","JP"]}');
select is(pg_temp.room()->>'stage', 'picks', 'two of three submissions do not start voting');
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select public.remove_trip_member((select id from quest_test_trip), (select id from public.trip_members where trip_id = (select id from quest_test_trip) and user_id = '33333333-3333-4333-8333-333333333333'), extensions.gen_random_uuid());
select is(pg_temp.room()->>'stage', 'voting', 'removing the pending member automatically unlocks voting');
select is(pg_temp.room()->'countries', '["JP","MY","TH"]'::jsonb, 'cards compile unique country picks in stable order');
select is(jsonb_array_length(pg_temp.room()->'members'), 2, 'removed members no longer block the quest');
select throws_ok($$select pg_temp.act('{"type":"picks","countryCodes":["FR"]}')$$, '22023', 'Country picks are locked for this round.', 'compiled cards are immutable for this round');
select throws_ok($$select pg_temp.act('{"type":"vote","countryCode":"FR","agree":true}')$$, '22023', 'Vote agree or disagree on a country in this round.', 'a ballot cannot add an uncompiled country');
select throws_ok($$select pg_temp.act('{"type":"vote","countryCode":"MY","agree":"yes"}')$$, '22023', 'Vote agree or disagree on a country in this round.', 'a ballot requires a real boolean');
select pg_temp.act('{"type":"vote","countryCode":"MY","agree":false}');
select pg_temp.act('{"type":"vote","countryCode":"MY","agree":true}');
select is(pg_temp.room()->'ownVotes'->'MY', 'true'::jsonb, 'a member can change one open vote without duplicate ballots');
select pg_temp.act('{"type":"vote","countryCode":"TH","agree":false}');
select pg_temp.act('{"type":"vote","countryCode":"JP","agree":false}');
select is(pg_temp.room()->'results', '[]'::jsonb, 'one completed ballot never reveals totals');
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select is(pg_temp.room()->'ownVotes', '{}'::jsonb, 'private votes never appear in another member snapshot');
select is((select count(*)::integer from public.trip_quest_inputs), 1, 'direct input reads still hide every other ballot');
select pg_temp.act('{"type":"vote","countryCode":"MY","agree":false}');
select pg_temp.act('{"type":"vote","countryCode":"TH","agree":true}');
select pg_temp.act('{"type":"vote","countryCode":"JP","agree":false}');
select is(pg_temp.room()->>'stage', 'voting', 'a tie waits for explicit host resolution');
select is(pg_temp.room()->'tiedCountryCodes', '["MY","TH"]'::jsonb, 'only equal positive leaders appear in a tie');
select is(pg_temp.room()->'results', '[{"countryCode":"MY","agreeCount":1},{"countryCode":"TH","agreeCount":1},{"countryCode":"JP","agreeCount":0}]'::jsonb, 'all completed votes reveal accurate shared totals');
select throws_ok($$select pg_temp.act('{"type":"vote","countryCode":"TH","agree":false}')$$, '22023', 'Voting is already closed.', 'complete ballots lock before tie resolution');
select throws_ok($$select pg_temp.act('{"type":"resolve_tie","countryCode":"MY"}')$$, '42501', 'Only the organiser can advance this quest stage.', 'only the host resolves ties');
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select throws_ok($$select pg_temp.act('{"type":"resolve_tie","countryCode":"JP"}')$$, '22023', 'Choose one of the tied countries after everyone has voted.', 'host cannot choose a losing country');
select throws_ok($$select pg_temp.act('{"type":"restart_picks"}')$$, '22023', 'Start fresh picks only when everyone has voted and no country received a like.', 'a positive tie cannot be silently discarded');
select pg_temp.act('{"type":"resolve_tie","countryCode":"MY"}');
select is(pg_temp.room()->>'stage', 'explore', 'tie resolution opens the country map');
select is(pg_temp.room()->>'selectedCountryCode', 'MY', 'selected country is shared and persisted');
select throws_ok($$select pg_temp.act('{"type":"attractions","attractionIds":["th-wat-arun"]}')$$, '22023', 'Choose at least one attraction in the selected country.', 'map selection rejects attractions in another country');
select throws_ok($$select pg_temp.act('{"type":"attractions","attractionIds":["my-invented-place"]}')$$, '22023', 'Choose at least one attraction in the selected country.', 'map selection rejects fictional attraction identifiers');
select pg_temp.act('{"type":"attractions","attractionIds":["my-george-town"]}');
select is(pg_temp.room()->>'stage', 'budget', 'saving map attractions opens budget planning');
select throws_ok($$select pg_temp.act('{"type":"budget","amount":0}')$$, '22023', 'Enter a whole MYR budget between 1 and 1,000,000.', 'zero budget is rejected');
select throws_ok($$select pg_temp.act('{"type":"budget","amount":1500.5}')$$, '22023', 'Enter a whole MYR budget between 1 and 1,000,000.', 'fractional budget is rejected');
select throws_ok($$select pg_temp.act('{"type":"budget","amount":1000001}')$$, '22023', 'Enter a whole MYR budget between 1 and 1,000,000.', 'budget maximum is enforced');
select pg_temp.act('{"type":"budget","amount":4000}');
select is(pg_temp.room()->'budgetSummary', 'null'::jsonb, 'budgets remain private until everyone submits');
select throws_ok($$select pg_temp.act('{"type":"finish"}')$$, '22023', 'Everyone must submit a budget before the organiser can finish.', 'host cannot finish before every member budget');
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select pg_temp.act('{"type":"budget","amount":1500}');
select is((pg_temp.room()->'budgetSummary'->>'comfortablePerPerson')::integer, 1500, 'group ceiling is the lowest member maximum, never the average');
select ok(not (pg_temp.room()->'budgetSummary' ? 'max') and not (pg_temp.room()->'budgetSummary' ? 'min'), 'budget summary does not disclose unused individual extrema');
select throws_ok($$select pg_temp.act('{"type":"finish"}')$$, '42501', 'Only the organiser can advance this quest stage.', 'a member cannot finish the trip for everyone');
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select pg_temp.act('{"type":"finish"}', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
select is(pg_temp.room()->>'stage', 'logistics', 'budget advances to Logistics');
create temporary table completed_revision as select (pg_temp.room()->>'revision')::integer as value;
select lives_ok($$select pg_temp.act('{"type":"finish"}', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')$$, 'network retries safely replay a completed action');
select is((pg_temp.room()->>'revision')::integer, (select value from completed_revision), 'retries do not repeat mutation side effects');
select throws_ok($$select pg_temp.act('{"type":"budget","amount":100}', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')$$, '22023', 'This request identifier was already used for a different quest action.', 'idempotency keys cannot be reused with different payloads');
select throws_ok($$select pg_temp.act('{"type":"budget","amount":100}')$$, '22023', 'Budgets can be submitted during the budget stage.', 'completed plans are immutable');
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select throws_ok('select pg_temp.room()', '42501', 'Trip Room access is unavailable.', 'removed participants lose room access');
select ok(not private.can_access_quest_topic('trip:' || (select id from quest_test_trip)::text || ':quest'), 'removed participants lose private realtime authorization');
select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
select throws_ok('select pg_temp.room()', '42501', 'Trip Room access is unavailable.', 'a nonmember cannot load the quest');
select is((select count(*)::integer from public.trip_quests), 0, 'a nonmember cannot read shared quest tables');

-- Exercise an all-disagree round, restart and automatic unique winner on a
-- second trip, without editing the state machine tables to set up its stages.
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select public.create_trip('Solo quest test', 'undecided', '{}', null, null, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
update quest_test_trip set id = (select id from public.trips where name = 'Solo quest test');
reset role;
update public.trips set planning_started_at = now() where id = (select id from quest_test_trip);
set local role authenticated;
select pg_temp.act(jsonb_build_object('type','availability','startsOn',current_date+50,'endsOn',current_date+54));
reset role;
select public.save_date_recommendation((select id from quest_test_trip),
  (select organizer_member_id from public.trips where id = (select id from quest_test_trip)),
  (select revision from public.trip_quests where trip_id = (select id from quest_test_trip)),
  jsonb_build_object('calendarVersion', (select version from public.national_holiday_calendar where id = 1), 'periods', jsonb_build_array(pg_temp.period_action(50,54)->'period')));
set local role authenticated;
select pg_temp.act(pg_temp.period_action(50,54));
select pg_temp.act('{"type":"picks","countryCodes":["JP","MY"]}');
select pg_temp.act('{"type":"vote","countryCode":"MY","agree":false}');
select pg_temp.act('{"type":"vote","countryCode":"JP","agree":false}');
select is(pg_temp.room()->>'stage', 'voting', 'all-disagree results do not select an arbitrary country');
select is(pg_temp.room()->'tiedCountryCodes', '[]'::jsonb, 'zero-like options are not mislabelled as a tie');
select pg_temp.act('{"type":"restart_picks"}');
select is(pg_temp.room()->>'stage', 'picks', 'host can restart a round with no likes');
select is(pg_temp.room()->'ownVotes', '{}'::jsonb, 'restart clears previous ballots');
select is(pg_temp.room()->'ownPicks', '[]'::jsonb, 'restart asks for fresh country nominations');
select pg_temp.act('{"type":"picks","countryCodes":["JP","MY"]}');
select pg_temp.act('{"type":"vote","countryCode":"MY","agree":true}');
select pg_temp.act('{"type":"vote","countryCode":"JP","agree":false}');
select is(pg_temp.room()->>'stage', 'explore', 'a unique positive winner opens the map automatically');
select is(pg_temp.room()->>'selectedCountryCode', 'MY', 'the unique like winner is preserved');

select * from finish();
rollback;
