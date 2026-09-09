begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(id) values ('88888888-1111-4111-8111-111111111111');
set local role authenticated;
select set_config('request.jwt.claim.sub','88888888-1111-4111-8111-111111111111',true);
create temporary table budget_trip as select (public.create_trip('Shared budget test','undecided','{}',null,null,extensions.gen_random_uuid())->>'tripId')::uuid as id;
grant select on budget_trip to service_role;
select throws_ok($$select * from public.trip_budget_recommendations$$,'42501',null,'clients cannot directly read other cached recommendations');
select throws_ok($$insert into public.trip_budget_recommendations(trip_id,cache_key,departure,options,estimate) select id,repeat('a',64),'Kuala Lumpur','{}','{}' from budget_trip$$,'42501',null,'clients cannot publish a shared AI estimate');
reset role;
set local role service_role;
insert into public.trip_budget_recommendations(trip_id,cache_key,departure,options,estimate)
 select id,repeat('a',64),'Kuala Lumpur','{"source":"first"}','{"total":3000}' from budget_trip;
insert into public.trip_budget_recommendations(trip_id,cache_key,departure,options,estimate)
 select id,repeat('a',64),'Kuala Lumpur','{"source":"second"}','{"total":4200}' from budget_trip on conflict(trip_id,cache_key) do nothing;
select is((select estimate->>'total' from public.trip_budget_recommendations where trip_id=(select id from budget_trip)),'3000','both devices receive the first saved total');
select is((select options->>'source' from public.trip_budget_recommendations where trip_id=(select id from budget_trip)),'first','the same priced options remain attached to the total');
select is((select count(*)::integer from public.trip_budget_recommendations where trip_id=(select id from budget_trip)),1,'duplicate requests cannot create separate recommendations');
reset role;
select * from finish();
rollback;
