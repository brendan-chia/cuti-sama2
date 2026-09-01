revoke execute on function public.create_trip(text, public.planning_mode, text[], date, date, uuid) from anon;
revoke execute on function public.manage_invite(uuid, text, text, timestamptz, uuid) from anon;
revoke execute on function public.resolve_invite(text) from anon;
revoke execute on function public.join_trip(text, text, boolean, uuid) from anon;

create index if not exists trip_members_user_id_idx on public.trip_members (user_id);
create index if not exists trips_organizer_member_id_idx on public.trips (organizer_member_id);
create index if not exists invites_created_by_member_id_idx on public.invites (created_by_member_id);
