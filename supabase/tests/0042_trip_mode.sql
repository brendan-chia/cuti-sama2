begin;
-- Disposable fixtures; all test data is rolled back.
insert into auth.users(instance_id,id,aud,role,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','b1111111-1111-4111-8111-111111111111','authenticated','authenticated',now(),now()),
('00000000-0000-0000-0000-000000000000','b2222222-2222-4222-8222-222222222222','authenticated','authenticated',now(),now());
set local role authenticated;
select set_config('request.jwt.claim.sub','b1111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claim.role','authenticated',true);
select public.create_trip('Trip Mode transaction test','undecided','{}',null,null,'b3333333-3333-4333-8333-333333333333');
create temporary table mode_trip as select id from public.trips where name='Trip Mode transaction test';
reset role;
insert into public.trip_members(trip_id,user_id,display_name,role) select id,'b2222222-2222-4222-8222-222222222222','Guest','member' from mode_trip;
update public.trips set planning_started_at=now() where id=(select id from mode_trip);
set local role authenticated;
select public.get_trip_quest((select id from mode_trip));
reset role;
update public.trip_quests set stage='complete',revision=42,selected_country_code='JP',period='{"startsOn":"2027-01-01","endsOn":"2027-01-01","label":"Day","reason":"Test"}' where trip_id=(select id from mode_trip);
set local role authenticated;
do $$
declare id uuid := (select id from mode_trip); result jsonb; payload jsonb := '{"days":[{"date":"2027-01-01","stops":[{"attractionId":"jp-sensoji","estimatedStartTime":"09:00","estimatedEndTime":"10:00","estimatedVisitMinutes":60,"estimatedTravelMinutesFromPrevious":0,"includedMealBreakMinutes":0}],"estimatedActivityCostMYR":0,"estimatedScheduledMinutes":60,"reservedMealBreakMinutes":0}],"completedIds":[]}';
begin
  assert public.get_trip_mode(id,42) = '{"revision":0,"data":null}'::jsonb, 'initial empty state';
  result := public.save_trip_mode(id,42,0,payload);
  assert result->>'revision'='1', 'save increments revision';
  assert public.get_trip_mode(id,42)->'data'=payload, 'reload persists';
  assert public.save_trip_mode(id,42,0,payload)=result, 'lost response retry is idempotent';
  begin
    perform public.save_trip_mode(id,42,0,jsonb_set(payload,'{completedIds}','["jp-sensoji"]'));
    raise exception 'conflict accepted';
  exception when serialization_failure then null; end;
  perform public.save_trip_mode(id,42,1,jsonb_set(payload,'{completedIds}','["jp-sensoji"]'));
  begin
    perform public.save_trip_mode(id,42,2,jsonb_set(jsonb_set(payload,'{completedIds}','["jp-sensoji"]'),'{days,0,stops,0,estimatedEndTime}','"10:30"'));
    raise exception 'completed stop moved';
  exception when raise_exception then if sqlerrm <> 'Completed stops cannot change.' then raise; end if; end;
  begin
    perform public.save_trip_mode(id,41,2,payload);
    raise exception 'stale itinerary accepted';
  exception when serialization_failure then null; end;
  perform set_config('request.jwt.claim.sub','b2222222-2222-4222-8222-222222222222',true);
  assert public.get_trip_mode(id,42)->>'revision'='2','member can read shared state';
  begin
    perform public.save_trip_mode(id,42,2,payload);
    raise exception 'member mutation accepted';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub','b4444444-4444-4444-8444-444444444444',true);
  begin
    perform public.get_trip_mode(id,42);
    raise exception 'nonmember read accepted';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
select 'Trip Mode database assertions passed' as result;
rollback;
