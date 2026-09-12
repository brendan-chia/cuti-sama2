begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(id,instance_id,aud,role,created_at,updated_at) values
 ('66666666-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated',now(),now());
set local role authenticated;
select set_config('request.jwt.claim.sub','66666666-1111-4111-8111-111111111111',true);
create temporary table solo_test as select (public.create_solo_trip('Solo choices','66666666-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->>'tripId')::uuid as id;
select is(public.get_trip_quest((select id from solo_test))->>'travelParty','solo','snapshot identifies solo mode');
reset role;
-- Confirm real dates instead of bypassing the date stage.
set local role authenticated;
select is(public.update_trip_quest((select id from solo_test), jsonb_build_object('type','availability','startsOn',current_date+1,'endsOn',current_date+4,'preferences',jsonb_build_object('flexibility','exact','daysOff','[]'::jsonb,'unavailable','[]'::jsonb)), '66666666-dddd-4ddd-8ddd-dddddddddddd')->>'stage','budget','confirming solo dates advances to private budgets');
select is(public.get_trip_quest((select id from solo_test))->'period'->>'startsOn',(current_date+1)::text,'confirmed start date is saved');
select is(public.update_trip_quest((select id from solo_test), jsonb_build_object('type','availability','startsOn',current_date+1,'endsOn',current_date+4,'preferences',jsonb_build_object('flexibility','exact','daysOff','[]'::jsonb,'unavailable','[]'::jsonb)), '66666666-dddd-4ddd-8ddd-dddddddddddd')->>'stage','budget','confirm date retry is idempotent');
set local role authenticated;
select public.update_trip_quest((select id from solo_test),'{"type":"budget","comfortableBudgetMYR":2000,"maxBudgetMYR":3000}',extensions.gen_random_uuid());
select is(public.update_trip_quest((select id from solo_test),'{"type":"finish"}',extensions.gen_random_uuid())->>'stage','picks','solo budget unlocks destination selection');
select throws_ok($$select public.update_trip_quest((select id from solo_test),'{"type":"picks","countryCodes":["JP","TH"]}',extensions.gen_random_uuid())$$,'22023','Choose one destination for your solo trip.','solo cannot submit several destinations');
select is(public.update_trip_quest((select id from solo_test),'{"type":"picks","countryCodes":["JP"]}','66666666-bbbb-4bbb-8bbb-bbbbbbbbbbbb')->>'stage','explore','solo goes directly to explore');
select is(public.get_trip_quest((select id from solo_test))->>'selectedCountryCode','JP','chosen destination persists');
select is(public.update_trip_quest((select id from solo_test),'{"type":"picks","countryCodes":["JP"]}','66666666-bbbb-4bbb-8bbb-bbbbbbbbbbbb')->>'stage','explore','retry is idempotent');
select throws_ok($$select public.update_trip_quest((select id from solo_test),'{"type":"vote","countryCode":"JP","agree":true}',extensions.gen_random_uuid())$$,'22023','Solo trips choose directly without voting.','solo country ballots rejected');
select throws_ok($$select public.update_trip_quest((select id from solo_test),'{"type":"stay_vote","stayId":"66666666-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}',extensions.gen_random_uuid())$$,'22023','Solo trips choose directly without voting.','solo stay ballots rejected');
reset role;
-- One-member GROUP trips must still keep the existing voting rules.
update public.trips set travel_party='group' where id=(select id from solo_test);
update public.trip_quests set stage='picks',selected_country_code=null where trip_id=(select id from solo_test);
update public.trip_quest_inputs set country_codes='{}' where trip_id=(select id from solo_test);
set local role authenticated;
select is(public.update_trip_quest((select id from solo_test),'{"type":"picks","countryCodes":["JP","TH"]}',extensions.gen_random_uuid())->>'stage','voting','one-member group still votes');
select is(public.get_trip_quest((select id from solo_test))->>'travelParty','group','group mode explicit');
select * from finish();
rollback;
