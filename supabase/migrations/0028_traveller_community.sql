-- Profiles remain private; discovery exposes only explicitly published summaries.
create table public.traveller_profiles (
 user_id uuid primary key references auth.users on delete cascade,
 display_name text not null default 'Traveller' check (char_length(btrim(display_name)) between 1 and 50),
 avatar_url text check (avatar_url is null or char_length(avatar_url) <= 1500000),
 favourite_places text[] not null default '{}' check (cardinality(favourite_places) <= 30),
 referral_code text not null unique default encode(extensions.gen_random_bytes(8),'hex'),
 referred_by uuid references public.traveller_profiles(user_id),
 created_at timestamptz not null default now()
);
alter table public.traveller_profiles enable row level security;
create policy own_profile on public.traveller_profiles for select to authenticated using (user_id=auth.uid());
create policy create_profile on public.traveller_profiles for insert to authenticated with check (user_id=auth.uid());
create policy edit_profile on public.traveller_profiles for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
revoke all on public.traveller_profiles from anon,authenticated;
grant select on public.traveller_profiles to authenticated;
grant insert(user_id), update(display_name,avatar_url,favourite_places) on public.traveller_profiles to authenticated;

alter table public.trips add column travel_party text not null default 'group' check (travel_party in ('group','solo'));
create table public.trip_listings (
 trip_id uuid primary key references public.trips on delete cascade,
 description text not null check (char_length(btrim(description)) between 10 and 1000),
 published boolean not null default false
);
alter table public.trip_listings enable row level security;
create policy organizer_listing on public.trip_listings for all to authenticated using (private.is_trip_organizer(trip_id)) with check (private.is_trip_organizer(trip_id));
revoke all on public.trip_listings from anon,authenticated;
grant select,insert,update on public.trip_listings to authenticated;

create table public.travel_memories (
 user_id uuid not null references auth.users on delete cascade,
 trip_id uuid not null references public.trips on delete cascade,
 completed_at timestamptz not null default now(),
 primary key(user_id,trip_id)
);
alter table public.travel_memories enable row level security;
create policy own_memories on public.travel_memories for select to authenticated using(user_id=auth.uid());
revoke all on public.travel_memories from anon,authenticated;
grant select on public.travel_memories to authenticated;

create function public.record_completed_trip(p_trip_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_active_trip_member(p_trip_id) or not exists(select 1 from public.trips t where t.id=p_trip_id and coalesce(t.ends_on,(select (q.period->>'endsOn')::date from public.trip_quests q where q.trip_id=t.id)) < current_date) then
  raise exception 'Only your past trips can be recorded as completed.';
 end if;
 insert into public.travel_memories(user_id,trip_id) values(auth.uid(),p_trip_id) on conflict do nothing;
end $$;

create function public.redeem_referral(p_code text) returns void language plpgsql security definer set search_path='' as $$
declare referrer uuid;
begin
 select user_id into referrer from public.traveller_profiles where referral_code=lower(btrim(p_code)) and user_id<>auth.uid();
 if referrer is null then raise exception 'Referral code is invalid.'; end if;
 update public.traveller_profiles set referred_by=referrer where user_id=auth.uid() and referred_by is null;
 if not found then raise exception 'A referral has already been applied.'; end if;
end $$;

create function public.discover_trips() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(item),'[]'::jsonb) from (
 select t.id, t.name, l.description, t.starts_on, t.ends_on,
 (select count(*) from public.trip_members m where m.trip_id=t.id and m.active) as travellers
 from public.trip_listings l join public.trips t on t.id=l.trip_id
 where l.published and t.travel_party='group' and t.planning_started_at is null
 and (t.ends_on is null or t.ends_on>=current_date)
 order by t.created_at desc limit 100
 ) item;
$$;

create function public.join_public_trip(p_trip_id uuid,p_display_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare t public.trips%rowtype; member_id uuid; next_number integer;
begin
 if auth.uid() is null then raise exception 'Authentication required.'; end if;
 if char_length(btrim(p_display_name)) not between 1 and 50 then raise exception 'Enter a display name.'; end if;
 select * into t from public.trips where id=p_trip_id for update;
 select id into member_id from public.trip_members where trip_id=p_trip_id and user_id=auth.uid() and active;
 if member_id is not null then return member_id; end if;
 if t.id is null or t.travel_party='solo' or t.planning_started_at is not null or t.ends_on<current_date or not exists(select 1 from public.trip_listings where trip_id=p_trip_id and published) then raise exception 'This trip is no longer open.'; end if;
 if exists(select 1 from public.trip_members where trip_id=p_trip_id and user_id=auth.uid()) then raise exception 'Ask the organiser to restore your membership.'; end if;
 if (select count(*) from public.trip_members where trip_id=p_trip_id and active)>=8 then raise exception 'This trip is full.'; end if;
 select coalesce(max(display_name_discriminator),0)+1 into next_number from public.trip_members where trip_id=p_trip_id;
 insert into public.trip_members(trip_id,user_id,display_name,display_name_discriminator,role) values(p_trip_id,auth.uid(),btrim(p_display_name),next_number,'member') returning id into member_id;
 return member_id;
end $$;

create function public.create_solo_trip(p_name text,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; tid uuid;
begin
 result:=public.create_trip(p_name,'undecided','{}',null,null,p_key);
 tid:=(result->>'tripId')::uuid;
 update public.trips set travel_party='solo' where id=tid;
 update public.trip_members set lobby_ready=true where trip_id=tid and user_id=auth.uid();
 perform public.start_trip_planning(tid,p_key);
 return result;
end $$;

create function private.guard_solo_membership() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.trips where id=new.trip_id and travel_party='solo') and new.role<>'organizer' then raise exception 'Solo trips do not accept other travellers.'; end if;
 return new;
end $$;
create trigger guard_solo_membership before insert or update on public.trip_members for each row execute function private.guard_solo_membership();

revoke all on function public.record_completed_trip(uuid),public.redeem_referral(text),public.discover_trips(),public.join_public_trip(uuid,text),public.create_solo_trip(text,uuid) from public,anon;
grant execute on function public.record_completed_trip(uuid),public.redeem_referral(text),public.discover_trips(),public.join_public_trip(uuid,text),public.create_solo_trip(text,uuid) to authenticated;
grant execute on function public.discover_trips() to anon;
