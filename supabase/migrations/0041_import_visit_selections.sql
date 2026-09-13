-- Confirming a place also selects it for the importing traveller, without advancing Explore.
create or replace function public.confirm_trip_places(p_import_id uuid, p_place_ids text[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare source public.trip_place_imports%rowtype; quest public.trip_quests%rowtype; candidate jsonb;
begin
  select * into source from public.trip_place_imports where id = p_import_id;
  if source.id is null or not private.is_quest_participant(source.trip_id) or not exists (
    select 1 from public.trip_members m where m.id = source.member_id and m.user_id = (select auth.uid()) and m.active
  ) then raise exception using errcode = '42501', message = 'This import is unavailable to your member session.'; end if;
  perform 1 from public.trips where id = source.trip_id for update;
  select * into quest from public.trip_quests where trip_id = source.trip_id;
  if quest.stage <> 'explore' or source.status <> 'ready' then raise exception 'Confirm places during Explore after the search completes.'; end if;
  if coalesce(cardinality(p_place_ids), 0) not between 1 and 12 or cardinality(p_place_ids) <> (select count(distinct id) from unnest(p_place_ids) id) then raise exception 'Choose at least one distinct place.'; end if;
  if exists (select 1 from unnest(p_place_ids) id where not exists (
    select 1 from jsonb_array_elements(source.candidates) c where c->>'id' = id and c->>'countryCode' = quest.selected_country_code
  )) then raise exception 'Choose only verified search candidates in the selected country.'; end if;
  if (select count(*) from public.trip_confirmed_places where trip_id = source.trip_id) +
    (select count(*) from unnest(p_place_ids) id where not exists (select 1 from public.trip_confirmed_places p where p.trip_id = source.trip_id and p.place_id = id)) > 40 then
    raise exception 'Your crew has saved 40 places. Keep this collection focused.';
  end if;
  for candidate in select c from jsonb_array_elements(source.candidates) c where c->>'id' = any(p_place_ids) loop
    insert into public.trip_confirmed_places(trip_id, place_id, place, confirmed_by, source_post)
      values (source.trip_id, candidate->>'id', candidate, source.member_id, source.source_url) on conflict do nothing;
  end loop;
  if (select count(distinct id) from public.trip_quest_inputs i cross join lateral unnest(i.attraction_votes || p_place_ids) id where i.trip_id = source.trip_id and i.member_id = source.member_id) > 20 then
    raise exception 'You can select up to 20 places. Remove a selection before adding more.';
  end if;
  update public.trip_quest_inputs i set attraction_votes = (
    select array_agg(distinct id order by id) from unnest(i.attraction_votes || p_place_ids) id
  ) where i.trip_id = source.trip_id and i.member_id = source.member_id;
  update public.trip_quests set revision = revision + 1, updated_at = now() where trip_id = source.trip_id;
  return public.get_trip_quest(source.trip_id);
end;
$$;
