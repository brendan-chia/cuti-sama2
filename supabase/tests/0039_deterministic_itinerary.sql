begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(instance_id,id,aud,role,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','a1111111-1111-4111-8111-111111111111','authenticated','authenticated',now(),now()),
('00000000-0000-0000-0000-000000000000','a2222222-2222-4222-8222-222222222222','authenticated','authenticated',now(),now());
set local role authenticated;
select set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claim.role','authenticated',true);
select public.create_trip('Deterministic planner test','undecided','{}',null,null,'a3333333-3333-4333-8333-333333333333');
create temporary table planner_trip as select id from public.trips where name='Deterministic planner test';
reset role;
insert into public.trip_members(trip_id,user_id,display_name,role)
select id,'a2222222-2222-4222-8222-222222222222','Guest','member' from planner_trip;
update public.trips set planning_started_at=now() where id=(select id from planner_trip);
set local role authenticated;
select public.get_trip_quest((select id from planner_trip));
reset role;
update public.trip_quests set stage='explore', selected_country_code='JP',
 period=jsonb_build_object('startsOn',current_date+30,'endsOn',current_date+32,'label','Three days','reason','Locked dates')
 where trip_id=(select id from planner_trip);
update public.trip_quest_inputs set comfortable_budget_myr=1000,max_budget_myr=1500,
 attraction_votes=case when member_id=(select organizer_member_id from public.trips where id=(select id from planner_trip))
 then array['jp-sensoji'] else '{}'::text[] end
 where trip_id=(select id from planner_trip);
create function pg_temp.planner_action(action jsonb, key uuid default extensions.gen_random_uuid())
returns jsonb language sql as $$ select public.update_trip_quest((select id from planner_trip),action,key); $$;
set local role authenticated;
select is(public.get_trip_quest((select id from planner_trip))->>'plannerVersion','1.0','server advertises explicit subset support');
select is(public.get_trip_quest((select id from planner_trip))->'groupVibes','[]'::jsonb,'absent vibes stay neutral');
select throws_ok($$select pg_temp.planner_action('{"type":"compile_attractions","attractionIds":["jp-sensoji"]}')$$,
 '22023','Everyone must vote for attractions before compiling.','subset selection does not bypass all-voted gate');
select set_config('request.jwt.claim.sub','a2222222-2222-4222-8222-222222222222',true);
select pg_temp.planner_action('{"type":"attraction_votes","attractionIds":["jp-shibuya-sky"]}');
select throws_ok($$select pg_temp.planner_action('{"type":"compile_attractions","attractionIds":["jp-sensoji"]}')$$,
 '42501','Only the organiser can advance this quest stage.','members cannot build');
select set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
select throws_ok($$select pg_temp.planner_action('{"type":"compile_attractions","attractionIds":["jp-mount-fuji"]}')$$,
 '22023','Choose itinerary stops from the crew votes.','unvoted IDs are rejected');
select is(pg_temp.planner_action('{"type":"compile_attractions","attractionIds":["jp-sensoji"]}',
 'a4444444-4444-4444-8444-444444444444')->'attractionIds','["jp-sensoji"]'::jsonb,'organiser subset is authoritative');
select is(public.get_trip_quest((select id from planner_trip))->>'stage','logistics','successful build preserves logistics transition');
select is(pg_temp.planner_action('{"type":"compile_attractions","attractionIds":["jp-sensoji"]}',
 'a4444444-4444-4444-8444-444444444444')->'attractionIds','["jp-sensoji"]'::jsonb,'retry preserves the same selection');
select is(public.get_trip_quest((select id from planner_trip))->'attractionIds','["jp-sensoji"]'::jsonb,'reload preserves the selected inputs');
select * from finish();
rollback;
