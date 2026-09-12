-- Transactional regression checks; all fixtures are rolled back.
begin;
do $$
declare trip uuid := gen_random_uuid(); host uuid := gen_random_uuid(); guest uuid := gen_random_uuid();
  hm uuid := gen_random_uuid(); gm uuid := gen_random_uuid(); snapshot jsonb; rec jsonb; rev bigint; confirmed jsonb;
begin
  if has_function_privilege('authenticated','public.save_date_recommendation(uuid,uuid,bigint,jsonb)','execute') then raise exception 'Clients can forge recommendations'; end if;
  insert into auth.users(id,aud,role) values (host,'authenticated','authenticated'),(guest,'authenticated','authenticated');
  insert into public.trips(id,name,mode) values (trip,'Date recommendation regression','undecided');
  insert into public.trip_members(id,trip_id,user_id,display_name,role) values (hm,trip,host,'Host','organizer'),(gm,trip,guest,'Guest','member');
  update public.trips set organizer_member_id=hm,planning_started_at=now() where id=trip;
  perform set_config('request.jwt.claim.sub',host::text,true);
  perform public.update_trip_quest(trip,jsonb_build_object('type','availability','startsOn',current_date+50,'endsOn',current_date+54,
    'preferences',jsonb_build_object('flexibility','7','daysOff',jsonb_build_array(0,6),'unavailable',jsonb_build_array(jsonb_build_object('startsOn',current_date+70,'endsOn',current_date+75)))),gen_random_uuid());
  perform set_config('request.jwt.claim.sub',guest::text,true);
  snapshot := public.get_trip_quest(trip);
  if snapshot->'ownDatePreferences'->'unavailable' <> '[]'::jsonb or snapshot->'dateProposals' <> '[]'::jsonb then raise exception 'Private preferences leaked'; end if;
  snapshot := public.update_trip_quest(trip,jsonb_build_object('type','availability','startsOn',current_date+55,'endsOn',current_date+59),gen_random_uuid());
  confirmed := jsonb_build_object('startsOn',current_date+52,'endsOn',current_date+56,'label','Combined dates','reason','Verified compromise');
  rec := jsonb_build_object('periods',jsonb_build_array(confirmed),'calendarVersion',(select version from public.national_holiday_calendar where id=1));
  rev := (snapshot->>'revision')::bigint;
  if public.save_date_recommendation(trip,gm,rev,rec) then raise exception 'Member published recommendation'; end if;
  if public.save_date_recommendation(trip,hm,rev-1,rec) then raise exception 'Stale generation saved'; end if;
  if not public.save_date_recommendation(trip,hm,rev,rec) then raise exception 'Valid recommendation not saved'; end if;
  snapshot := public.get_trip_quest(trip);
  if snapshot->'dateRecommendation' <> rec then raise exception 'Shared recommendation missing'; end if;
  -- Editing any preference invalidates the previous answer.
  snapshot := public.update_trip_quest(trip,jsonb_build_object('type','availability','startsOn',current_date+56,'endsOn',current_date+60),gen_random_uuid());
  if snapshot->'dateRecommendation' <> 'null'::jsonb then raise exception 'Stale answer visible'; end if;
  perform set_config('request.jwt.claim.sub',host::text,true);
  begin
    perform public.update_trip_quest(trip,jsonb_build_object('type','period','period',confirmed),gen_random_uuid());
    raise exception 'Stale recommendation confirmed';
  exception when invalid_parameter_value then null; end;
  rev := (snapshot->>'revision')::bigint;
  if not public.save_date_recommendation(trip,hm,rev,rec) then raise exception 'Cannot regenerate'; end if;
  -- Calendar refresh also invalidates the answer and permits regeneration at the same revision.
  update public.national_holiday_calendar set version=version||'-updated' where id=1;
  snapshot := public.get_trip_quest(trip);
  if snapshot->'dateRecommendation' <> 'null'::jsonb then raise exception 'Old calendar recommendation shown'; end if;
  rec := jsonb_set(rec,'{calendarVersion}',to_jsonb((select version from public.national_holiday_calendar where id=1)));
  if not public.save_date_recommendation(trip,hm,(snapshot->>'revision')::bigint,rec) then raise exception 'Calendar refresh cannot regenerate'; end if;
  snapshot := public.update_trip_quest(trip,jsonb_build_object('type','period','period',confirmed),gen_random_uuid());
  if snapshot->>'stage' <> 'budget' then raise exception 'Combined period did not unlock budgets'; end if;
  if snapshot->'period' <> confirmed then raise exception 'Confirmed dates changed'; end if;
end; $$;
rollback;
