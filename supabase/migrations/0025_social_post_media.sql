-- Keep image/video item identity and resumable per-item audio checkpoints.
alter table public.trip_video_jobs add column media_manifest jsonb not null default '{}';
alter table public.trip_video_jobs add column audio_items_done integer[] not null default '{}';
alter table public.trip_video_jobs alter column pipeline_version set default 3;
alter table public.trip_video_jobs alter column message set default 'Waiting for the local post worker.';
notify pgrst, 'reload schema';
