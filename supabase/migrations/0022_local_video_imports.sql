-- Full-video jobs are private to the importing member. Only the worker bridge writes them.
create table public.trip_video_jobs (
  import_id uuid primary key references public.trip_place_imports(id) on delete cascade,
  state text not null default 'queued' check (state in ('uploading','queued','running','done','failed','cancelled')),
  caption text not null default '', storage_path text,
  lease uuid, heartbeat timestamptz, created_at timestamptz not null default now(),
  media_hash text, total_frames integer not null default 0 check (total_frames between 0 and 7200),
  processed_frames integer not null default 0 check (processed_frames between 0 and total_frames),
  audio_done boolean not null default false, transcript text not null default '',
  observations jsonb not null default '[]', message text not null default 'Waiting for the local video worker.'
);
alter table public.trip_video_jobs enable row level security;
revoke all on public.trip_video_jobs from public, anon, authenticated;
grant all on public.trip_video_jobs to service_role;
create table public.video_worker_presence (id integer primary key check (id=1), seen_at timestamptz not null);
alter table public.video_worker_presence enable row level security;
revoke all on public.video_worker_presence from public, anon, authenticated;
grant all on public.video_worker_presence to service_role;
create function public.claim_video_import()
returns jsonb language plpgsql security definer set search_path='' as $$
declare job public.trip_video_jobs%rowtype; begin
  insert into public.video_worker_presence values (1,now()) on conflict(id) do update set seen_at=now();
  select j.* into job from public.trip_video_jobs j
    join public.trip_place_imports i on i.id=j.import_id
    join public.trip_members m on m.id=i.member_id and m.active
    join public.trip_quests q on q.trip_id=i.trip_id and q.stage='explore'
    where j.state='queued' or (j.state='running' and j.heartbeat<now()-interval '3 minutes')
    order by j.created_at for update of j skip locked limit 1;
  if job.import_id is null then return null; end if;
  update public.trip_video_jobs set state='running',lease=gen_random_uuid(),heartbeat=now(),message='Preparing the full video.'
    where import_id=job.import_id returning * into job;
  return to_jsonb(job);
end; $$;
revoke all on function public.claim_video_import() from public, anon, authenticated;
grant execute on function public.claim_video_import() to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values ('trip-video-imports','trip-video-imports',false,157286400,array['video/mp4','video/quicktime','video/webm']) on conflict(id) do nothing;
notify pgrst,'reload schema';
create function public.finish_video_import(p_import_id uuid,p_lease uuid,p_candidates jsonb,p_message text)
returns boolean language plpgsql security definer set search_path='' as $$
declare i public.trip_place_imports%rowtype; begin
 select * into i from public.trip_place_imports where id=p_import_id;
 perform 1 from public.trips where id=i.trip_id for update;
 if not exists(select 1 from public.trip_members where id=i.member_id and active)
   or not exists(select 1 from public.trip_quests where trip_id=i.trip_id and stage='explore') then return false; end if;
 update public.trip_video_jobs set state='done',message=p_message,heartbeat=now()
   where import_id=p_import_id and lease=p_lease and state='running' and total_frames>0 and processed_frames=total_frames and audio_done;
 if not found then return false; end if;
 update public.trip_place_imports set candidates=p_candidates,status=case when jsonb_array_length(p_candidates)>0 then 'ready' else 'needs_input' end,message=p_message where id=p_import_id;
 return true;
end; $$;
revoke all on function public.finish_video_import(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.finish_video_import(uuid,uuid,jsonb,text) to service_role;
