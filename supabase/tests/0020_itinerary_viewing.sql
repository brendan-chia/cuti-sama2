-- Participant viewing must not mutate an in-flight itinerary; expired retries are fenced.
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
insert into auth.users(id) values ('77777777-7777-4777-8777-777777777777');
insert into public.trip_members(trip_id,user_id,display_name,role) select id,'77777777-7777-4777-8777-777777777777','Participant','member' from quest_itinerary_trip;
update public.trips set planning_started_at = now() where id = (select id from quest_itinerary_trip);
set local role authenticated;
select public.get_trip_quest((select id from quest_itinerary_trip));
select throws_ok('select public.prepare_quest_itinerary((select id from quest_itinerary_trip))','22023','Complete the planning stages and everyone’s budget before generating an itinerary.','unfinished quests cannot generate');
reset role;
update public.trip_quests set stage='complete', revision=9, selected_country_code='JP',
 period=jsonb_build_object('startsOn','2027-12-04','endsOn','2027-12-08','label','Trip','reason','Shared dates'),
 attraction_ids=array['jp-fuji'] where trip_id=(select id from quest_itinerary_trip);
update public.trip_quest_inputs set comfortable_budget_myr=5000,max_budget_myr=5000 where trip_id=(select id from quest_itinerary_trip);
set local role authenticated;
select is(public.prepare_quest_itinerary((select id from quest_itinerary_trip))->'room'->>'stage','complete','completed quest is available to the generator');
select is(public.get_planning_itinerary_state((select id from quest_itinerary_trip))->'lockedDestination'->>'name','Japan','existing itinerary UI reads the quest destination');
select is((select starts_on::text from public.trips where id=(select id from quest_itinerary_trip)),'2027-12-04','confirmed dates are copied');
select is((select locked_destination_option_id from public.trips where id=(select id from quest_itinerary_trip)),'quest:JP:9','versions are scoped to quest revision');
select ok(not has_function_privilege('anon','public.prepare_quest_itinerary(uuid)','execute'),'guest callers cannot prepare private plans');
reset role;
create temporary table claimed as select public.claim_itinerary_generation(t.id,m.id,'66666666-bbbb-4bbb-8bbb-bbbbbbbbbbbb') as value
 from quest_itinerary_trip t join public.trip_members m on m.trip_id=t.id and m.role='organizer';
select is((select value->>'status' from claimed),'claimed','first organiser request claims generation');
select is(public.claim_itinerary_generation(t.id,m.id,'66666666-bbbb-4bbb-8bbb-bbbbbbbbbbbb')->>'status','pending','same-key duplicate does not start another attempt') from quest_itinerary_trip t join public.trip_members m on m.trip_id=t.id and m.role='organizer';
select is(public.claim_itinerary_generation(t.id,m.id,'66666666-cccc-4ccc-8ccc-cccccccccccc')->>'status','pending','different-key duplicate also waits') from quest_itinerary_trip t join public.trip_members m on m.trip_id=t.id and m.role='organizer';
create temporary table before_view as select to_jsonb(t) as trip, to_jsonb(q) as quest from public.trips t join public.trip_quests q on q.trip_id=t.id where t.id=(select id from quest_itinerary_trip);
grant select on before_view to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777777',true);
select is(public.get_planning_itinerary_state((select id from quest_itinerary_trip))->'operation'->>'status','pending','participant sees pending generation');
select is(public.get_planning_itinerary_state((select id from quest_itinerary_trip))->>'currentRole','member','participant retains view-only role');
select throws_ok('select public.prepare_quest_itinerary((select id from quest_itinerary_trip))','42501','Only the organiser can prepare an itinerary.','participant cannot prepare');
reset role;
select is((select to_jsonb(t) from public.trips t where id=(select id from quest_itinerary_trip)),(select trip from before_view),'view leaves the trip completely unchanged');
select is((select to_jsonb(q) from public.trip_quests q where trip_id=(select id from quest_itinerary_trip)),(select quest from before_view),'view leaves the quest completely unchanged');
update public.itinerary_generation_operations set lease_started_at=now()-interval '4 minutes' where trip_id=(select id from quest_itinerary_trip);
create temporary table retried as select public.claim_itinerary_generation(t.id,m.id,'66666666-bbbb-4bbb-8bbb-bbbbbbbbbbbb') as value
 from quest_itinerary_trip t join public.trip_members m on m.trip_id=t.id and m.role='organizer';
select is((select value->>'status' from retried),'claimed','expired attempt can be retried');
select ok((select value->>'lease' from retried) <> (select value->>'lease' from claimed),'retry gets a new lease');
select throws_ok(format($q$select public.store_claimed_itinerary(%L,%L,'quest:JP:9',now(),'{}','{}')$q$,(select value->>'id' from claimed),(select value->>'lease' from claimed)), '22023','A newer generation attempt has replaced this request. Refresh the itinerary.','expired attempt cannot save');
select set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666666',true);
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
