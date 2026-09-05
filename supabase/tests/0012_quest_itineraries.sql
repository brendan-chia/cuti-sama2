-- Run with supabase test db after applying migration 0018.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users (instance_id,id,aud,role,created_at,updated_at) values
 ('00000000-0000-0000-0000-000000000000','66666666-6666-4666-8666-666666666666','authenticated','authenticated',now(),now());
set local role authenticated;
select set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666666',true);
select public.create_trip('Quest itinerary test','undecided','{}',null,null,'66666666-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
reset role;
create temporary table quest_itinerary_trip as select id from public.trips where name = 'Quest itinerary test';
grant select on quest_itinerary_trip to authenticated;
update public.trips set planning_started_at = now() where id = (select id from quest_itinerary_trip);
set local role authenticated;
select public.get_trip_quest((select id from quest_itinerary_trip));
select throws_ok('select public.prepare_quest_itinerary((select id from quest_itinerary_trip))','22023','Complete the planning stages and everyone’s budget before generating an itinerary.','unfinished quests cannot generate');
reset role;
update public.trip_quests set stage='complete', revision=9, selected_country_code='JP',
 period=jsonb_build_object('startsOn','2027-12-04','endsOn','2027-12-08','label','Trip','reason','Shared dates'),
 attraction_ids=array['jp-fuji'] where trip_id=(select id from quest_itinerary_trip);
update public.trip_quest_inputs set budget=5000 where trip_id=(select id from quest_itinerary_trip);
set local role authenticated;
select is(public.prepare_quest_itinerary((select id from quest_itinerary_trip))->'room'->>'stage','complete','completed quest is available to the generator');
select is(public.get_planning_itinerary_state((select id from quest_itinerary_trip))->'lockedDestination'->>'name','Japan','existing itinerary UI reads the quest destination');
select is((select starts_on::text from public.trips where id=(select id from quest_itinerary_trip)),'2027-12-04','confirmed dates are copied');
select is((select locked_destination_option_id from public.trips where id=(select id from quest_itinerary_trip)),'quest:JP:9','versions are scoped to quest revision');
select ok(not has_function_privilege('anon','public.prepare_quest_itinerary(uuid)','execute'),'guest callers cannot prepare private plans');
reset role;
insert into public.itinerary_generation_operations(trip_id,requested_by,idempotency_key)
 select t.id,m.id,'66666666-bbbb-4bbb-8bbb-bbbbbbbbbbbb' from quest_itinerary_trip t join public.trip_members m on m.trip_id=t.id;
select throws_ok(format($q$select public.store_generated_itinerary(%L,%L,%L,%L::jsonb,%L::jsonb)$q$,
 (select id from public.itinerary_generation_operations where trip_id=(select id from quest_itinerary_trip)),
 'quest:JP:9',(select destination_locked_at from public.trips where id=(select id from quest_itinerary_trip)),
 '{"schemaVersion":"1.0","days":[{"dayNumber":1}]}','{"questRevision":8}'),
 '22023','The group plan changed during generation. Generate a new itinerary from the latest plan.','stale quest drafts cannot be stored');
select lives_ok(format($q$select public.store_generated_itinerary(%L,%L,%L,%L::jsonb,%L::jsonb)$q$,
 (select id from public.itinerary_generation_operations where trip_id=(select id from quest_itinerary_trip)),
 'quest:JP:9',(select destination_locked_at from public.trips where id=(select id from quest_itinerary_trip)),
 '{"schemaVersion":"1.0","days":[{"dayNumber":1}]}','{"questRevision":9}'),'current quest draft can be stored');
set local role authenticated;
select is((public.get_planning_itinerary_state((select id from quest_itinerary_trip))->'latest'->>'version')::integer,1,'saved draft can be reopened');
reset role;
update public.trip_quests set revision=10, updated_at=now()+interval '1 second' where trip_id=(select id from quest_itinerary_trip);
set local role authenticated;
select is(public.get_planning_itinerary_state((select id from quest_itinerary_trip))->'latest','null'::jsonb,'a changed plan clears the old active itinerary');
select is(public.get_planning_itinerary_state((select id from quest_itinerary_trip))->'operation','null'::jsonb,'a changed plan does not retry an old operation');
select * from finish();
rollback;
