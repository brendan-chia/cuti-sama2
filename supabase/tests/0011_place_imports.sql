-- Standalone transactional regression checks. Safe to run against a linked project:
-- every fixture and change is rolled back, including failure paths.
begin;
do $$
declare
  trip uuid := gen_random_uuid(); host_user uuid := gen_random_uuid(); guest_user uuid := gen_random_uuid();
  host_member uuid := gen_random_uuid(); guest_member uuid := gen_random_uuid(); request_id uuid := gen_random_uuid();
  reservation jsonb; snapshot jsonb; place jsonb;
begin
  insert into auth.users(id, aud, role) values (host_user, 'authenticated', 'authenticated'), (guest_user, 'authenticated', 'authenticated');
  insert into public.trips(id, name, mode) values (trip, 'Import regression fixture', 'undecided');
  insert into public.trip_members(id, trip_id, user_id, display_name, role) values
    (host_member, trip, host_user, 'Host', 'organizer'), (guest_member, trip, guest_user, 'Guest', 'member');
  update public.trips set organizer_member_id = host_member, planning_started_at = now() where id = trip;
  perform set_config('request.jwt.claim.sub', host_user::text, true);
  perform public.get_trip_quest(trip);
  update public.trip_quests set stage = 'explore', selected_country_code = 'MY' where trip_id = trip;
  reservation := public.begin_place_import(trip, request_id, null);
  if reservation->>'fresh' <> 'true' then raise exception 'Import not reserved'; end if;
  if (public.begin_place_import(trip, request_id, null)->>'fresh') <> 'false' then raise exception 'Import not idempotent'; end if;
  place := jsonb_build_object('id', 'osm-node-123', 'name', 'Confirmed test place', 'address', 'Penang, Malaysia', 'countryCode', 'MY',
    'latitude', 5.4, 'longitude', 100.3, 'evidence', 'A caption', 'sourceUrl', 'https://www.openstreetmap.org/node/123');
  update public.trip_place_imports set status = 'ready', candidates = jsonb_build_array(place) where id = (reservation->>'id')::uuid;
  begin
    perform public.confirm_trip_places((reservation->>'id')::uuid, array['forged']);
    raise exception 'Forged candidate accepted';
  exception when raise_exception then if sqlerrm = 'Forged candidate accepted' then raise; end if; end;
  snapshot := public.confirm_trip_places((reservation->>'id')::uuid, array['osm-node-123']);
  if jsonb_array_length(snapshot->'importedPlaces') <> 1 then raise exception 'Confirmed place missing'; end if;
  snapshot := public.confirm_trip_places((reservation->>'id')::uuid, array['osm-node-123']);
  if jsonb_array_length(snapshot->'importedPlaces') <> 1 then raise exception 'Duplicate confirmation'; end if;
  perform set_config('request.jwt.claim.sub', guest_user::text, true);
  begin
    perform public.confirm_trip_places((reservation->>'id')::uuid, array['osm-node-123']);
    raise exception 'Another member confirmed a private import';
  exception when insufficient_privilege then null; end;
  snapshot := public.get_trip_quest(trip);
  if jsonb_array_length(snapshot->'importedPlaces') <> 1 then raise exception 'Confirmed place not shared'; end if;
  if (public.begin_place_import(trip, gen_random_uuid(), null)->>'fresh') <> 'true' then raise exception 'Guest cannot import'; end if;
  perform set_config('request.jwt.claim.sub', host_user::text, true);
  snapshot := public.update_trip_quest(trip, '{"type":"attraction_votes","attractionIds":["osm-node-123"]}', gen_random_uuid());
  perform set_config('request.jwt.claim.sub', guest_user::text, true);
  perform public.update_trip_quest(trip, '{"type":"attraction_votes","attractionIds":["osm-node-123"]}', gen_random_uuid());
  perform set_config('request.jwt.claim.sub', host_user::text, true);
  snapshot := public.update_trip_quest(trip, '{"type":"compile_attractions"}', gen_random_uuid());
  if snapshot->>'stage' <> 'logistics' then raise exception 'Confirmed stop cannot be selected'; end if;
  begin
    perform public.confirm_trip_places((reservation->>'id')::uuid, array['osm-node-123']);
    raise exception 'Confirmation allowed after Explore';
  exception when raise_exception then if sqlerrm = 'Confirmation allowed after Explore' then raise; end if; end;
  update public.trip_quests set stage = 'voting', countries = array['MY','JP'], results = '[]' where trip_id = trip;
  snapshot := public.update_trip_quest(trip, '{"type":"vote","countryCode":"MY","agree":true}', gen_random_uuid());
  if snapshot->'ownVotes'->>'MY' <> 'true' then raise exception 'Organiser could not vote'; end if;
  if jsonb_array_length(snapshot->'results') <> 0 then raise exception 'Votes revealed before guest votes'; end if;
  if has_table_privilege('authenticated', 'public.trip_place_imports', 'update') then raise exception 'Client can forge candidates'; end if;
  if has_function_privilege('anon', 'public.confirm_trip_places(uuid,text[])', 'execute') then raise exception 'Unauthenticated confirmation'; end if;
end;
$$;
select 'Place import, confirmation, permissions, and organiser voting checks passed' as result;
rollback;
