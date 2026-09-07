create table public.saved_inspiration (
 id uuid primary key default extensions.gen_random_uuid(),
 user_id uuid not null references auth.users on delete cascade,
 source_url text not null check (length(source_url)<=2000 and source_url like 'https://%'),
 folder text not null default 'Travel ideas' check (length(btrim(folder)) between 1 and 60),
 caption text not null default '' check (length(caption)<=6000),
 status text not null default 'saved' check (status in ('saved','analyzing','ready','needs_input','failed')),
 source_text text not null default '' check(length(source_text)<=18000),
 analysis jsonb, message text not null default 'Saved. Waiting for analysis.',
 provider text, model text, lease uuid,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,source_url)
);
alter table public.saved_inspiration enable row level security;
revoke all on public.saved_inspiration from anon,authenticated;
grant select,delete on public.saved_inspiration to authenticated;
grant all on public.saved_inspiration to service_role;
create policy own_saved_inspiration on public.saved_inspiration for select to authenticated using(user_id=auth.uid());
create policy delete_own_inspiration on public.saved_inspiration for delete to authenticated using(user_id=auth.uid());
create index saved_inspiration_user_date on public.saved_inspiration(user_id,created_at desc);

create function public.save_inspiration(p_url text,p_folder text,p_caption text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,29));
 if (select count(*) from public.saved_inspiration where user_id=auth.uid())>=200 and not exists(select 1 from public.saved_inspiration where user_id=auth.uid() and source_url=p_url) then raise exception 'Your folder holds 200 links. Remove a link before saving another.'; end if;
 insert into public.saved_inspiration(user_id,source_url,folder,caption) values(auth.uid(),p_url,btrim(p_folder),p_caption)
 on conflict(user_id,source_url) do update set folder=excluded.folder,
 caption=excluded.caption,
 status=case when saved_inspiration.caption<>excluded.caption then 'saved' else saved_inspiration.status end,
 analysis=case when saved_inspiration.caption<>excluded.caption then null else saved_inspiration.analysis end,
 lease=case when saved_inspiration.caption<>excluded.caption then null else saved_inspiration.lease end,
 updated_at=case when saved_inspiration.caption<>excluded.caption then now() else saved_inspiration.updated_at end
 returning id into result;
 return result;
end $$;
revoke all on function public.save_inspiration(text,text,text) from public,anon;
grant execute on function public.save_inspiration(text,text,text) to authenticated;
