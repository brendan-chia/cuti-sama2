begin;
do $$
declare trip uuid:=gen_random_uuid();usr uuid:=gen_random_uuid();member uuid:=gen_random_uuid();job uuid;claim jsonb;lease uuid;
begin
 if has_function_privilege('authenticated','public.claim_video_import()','execute') then raise exception 'Clients can claim jobs'; end if;
 if has_table_privilege('authenticated','public.trip_video_jobs','select') then raise exception 'Private video metadata exposed'; end if;
 insert into auth.users(id,aud,role)values(usr,'authenticated','authenticated');
 insert into public.trips(id,name,mode)values(trip,'Video queue regression','undecided');
 insert into public.trip_members(id,trip_id,user_id,display_name,role)values(member,trip,usr,'Test host','organizer');
 update public.trips set organizer_member_id=member,planning_started_at=now() where id=trip;
 perform set_config('request.jwt.claim.sub',usr::text,true);perform public.get_trip_quest(trip);
 update public.trip_quests set stage='explore',selected_country_code='JP' where trip_id=trip;
 insert into public.trip_place_imports(trip_id,member_id,request_id)values(trip,member,gen_random_uuid())returning id into job;
 insert into public.trip_video_jobs(import_id)values(job);
 -- Test only this fixture; don't claim any real queued import.
 update public.trip_video_jobs set state='running',lease=gen_random_uuid(),heartbeat=now(),total_frames=3,audio_done=true where import_id=job returning trip_video_jobs.lease into lease;
 if public.finish_video_import(job,lease,'[]','done') then raise exception 'Incomplete frames published'; end if;
 update public.trip_video_jobs set processed_frames=3 where import_id=job;
 if public.finish_video_import(job,gen_random_uuid(),'[]','done') then raise exception 'Wrong lease published'; end if;
 update public.trip_video_jobs set state='cancelled' where import_id=job;
 if public.finish_video_import(job,lease,'[]','done') then raise exception 'Cancelled job published'; end if;
 update public.trip_video_jobs set state='running' where import_id=job;
 if not public.finish_video_import(job,lease,'[]','done') then raise exception 'Complete analysis cannot publish'; end if;
 if (select state from public.trip_video_jobs where import_id=job)<>'done' then raise exception 'Completion not persisted'; end if;
end;$$;
rollback;
