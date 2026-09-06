alter table public.trip_video_jobs add column pipeline_version integer not null default 1;
alter table public.trip_video_jobs alter column pipeline_version set default 2;
alter table public.trip_video_jobs add column post_metadata jsonb not null default '{}';
alter table public.trip_video_jobs add column transcript_segments jsonb not null default '[]';
-- The worker resets legacy checkpoints on start. Finished imports are preserved.
notify pgrst, 'reload schema';
