begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(id, instance_id, aud, role, created_at, updated_at) values
 ('77777777-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated',now(),now()),
 ('77777777-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated',now(),now()),
 ('77777777-3333-4333-8333-333333333333','00000000-0000-0000-0000-000000000000','authenticated','authenticated',now(),now());
set local role authenticated;
select set_config('request.jwt.claim.sub','77777777-1111-4111-8111-111111111111',true);
create temporary table private_budget_trip as select (public.create_trip('Private ranges','undecided','{}',null,null,extensions.gen_random_uuid())->>'tripId')::uuid as id;
create function pg_temp.room() returns jsonb language sql as $$ select public.get_trip_quest((select id from private_budget_trip)); $$;
create function pg_temp.act(action jsonb) returns jsonb language sql as $$ select public.update_trip_quest((select id from private_budget_trip),action,extensions.gen_random_uuid()); $$;
reset role;
insert into public.trip_members(trip_id,user_id,display_name,role) select id,'77777777-2222-4222-8222-222222222222','Sarah','member' from private_budget_trip;
insert into public.trip_members(trip_id,user_id,display_name,role) select id,'77777777-3333-4333-8333-333333333333','Leaving','member' from private_budget_trip;
update public.trips set planning_started_at=now() where id=(select id from private_budget_trip);
set local role authenticated;
select pg_temp.room();
reset role;
update public.trip_quests set stage='budget', period=jsonb_build_object('startsOn',current_date+10,'endsOn',current_date+12,'label','Trip','reason','Shared') where trip_id=(select id from private_budget_trip);
set local role authenticated;
select throws_ok($$select pg_temp.act('{"type":"budget","comfortableBudgetMYR":3000,"maxBudgetMYR":2000}')$$,'22023',null,'maximum cannot be below comfortable');
select throws_ok($$select pg_temp.act('{"type":"budget","amount":2000}')$$,'22023',null,'old clients cannot submit ambiguous single values');
select throws_ok($$select pg_temp.act('{"type":"budget","comfortableBudgetMYR":1000,"maxBudgetMYR":2000,"memberId":"someone-else"}')$$,'22023',null,'budget actions cannot target another member');
select pg_temp.act('{"type":"budget","comfortableBudgetMYR":1000,"maxBudgetMYR":4000}');
select is(pg_temp.room()->'budgetSummary','null'::jsonb,'partial aggregate stays hidden');
select is(pg_temp.room()->'ownBudget','{"comfortableBudgetMYR":1000,"maxBudgetMYR":4000}'::jsonb,'caller receives only their own pair');
select set_config('request.jwt.claim.sub','77777777-2222-4222-8222-222222222222',true);
select is(pg_temp.room()->'ownBudget','null'::jsonb,'guest cannot see host values as their own');
select is((select count(*)::integer from public.trip_quest_inputs),1,'RLS hides other private rows');
select pg_temp.act('{"type":"budget","comfortableBudgetMYR":2000,"maxBudgetMYR":3000}');
select is(pg_temp.room()->'budgetSummary','null'::jsonb,'pending active participant blocks reveal');
select throws_ok($$select pg_temp.act('{"type":"finish"}')$$,'42501',null,'members cannot advance the crew');
select set_config('request.jwt.claim.sub','77777777-1111-4111-8111-111111111111',true);
select throws_ok($$select pg_temp.act('{"type":"finish"}')$$,'22023',null,'organiser cannot bypass pending budgets');
select public.remove_trip_member((select id from private_budget_trip),(select id from public.trip_members where trip_id=(select id from private_budget_trip) and user_id='77777777-3333-4333-8333-333333333333'),extensions.gen_random_uuid());
select is(pg_temp.room()->'budgetSummary','{"submittedCount":2,"crewComfortCeiling":1000,"crewHardCeiling":3000,"currency":"MYR"}'::jsonb,'independent active minima, with no owner identity or individual array');
select ok(not exists(select 1 from jsonb_array_elements(pg_temp.room()->'members') m where m ?| array['comfortableBudgetMYR','maxBudgetMYR','budget','strain']),'shared members contain readiness only');
select is(pg_temp.act('{"type":"finish"}')->>'stage','picks','Budget unlocks Wishlist');
-- Exercise migration resume behavior without discarding saved downstream choices.
reset role;
update public.trip_quests set stage='budget',budget_resume_stage='explore',selected_country_code='JP' where trip_id=(select id from private_budget_trip);
set local role authenticated;
select is(pg_temp.act('{"type":"finish"}')->>'stage','explore','previously persisted rooms resume their saved stage');
select is(pg_temp.room()->>'selectedCountryCode','JP','resumption preserves destination');
select set_config('request.jwt.claim.sub','77777777-3333-4333-8333-333333333333',true);
select throws_ok('select pg_temp.room()','42501',null,'inactive participant cannot read private or aggregate room data');
select * from finish();
rollback;
