-- Private saved posts can be processed before a trip or country exists.
alter table public.saved_inspiration add column media_state jsonb;
create function public.claim_inspiration_media() returns jsonb
language plpgsql security definer set search_path='' as $$
declare idea public.saved_inspiration; token uuid := extensions.gen_random_uuid();
begin
 select * into idea from public.saved_inspiration
 where status='analyzing' and media_state is not null
 and (media_state->>'queued'='true' or updated_at < now()-interval '2 minutes')
 order by updated_at for update skip locked limit 1;
 if not found then return null; end if;
 update public.saved_inspiration set lease=token, updated_at=now(),
 media_state=media_state || '{"queued":false}'::jsonb,
 message='Reading post images and available audio.' where id=idea.id;
 return jsonb_build_object('import_id',idea.id,'lease',token,'sourceUrl',idea.source_url);
end $$;
revoke all on function public.claim_inspiration_media() from public,anon,authenticated;
grant execute on function public.claim_inspiration_media() to service_role;
