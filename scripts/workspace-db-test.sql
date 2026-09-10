-- Isolated PostgreSQL harness. Run only in an empty disposable test database.
-- The fixture reproduces the existing membership columns and auth.uid contract.
\set ON_ERROR_STOP on
do $$begin create role anon; exception when duplicate_object then null; end$$;
do $$begin create role authenticated; exception when duplicate_object then null; end$$;
create schema auth;
create schema private;
create table public.trip_quests(trip_id uuid, period jsonb, selected_country_code text, stage text);
create table public.trip_quest_inputs(trip_id uuid,member_id uuid,budget integer);
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table public.trips(id uuid primary key,name text,travel_party text,planning_started_at timestamptz);
create table public.trip_members(id uuid primary key,trip_id uuid references public.trips(id),user_id uuid references auth.users(id),display_name text,role text,active boolean default true,created_at timestamptz default now());
\ir ../supabase/migrations/0037_trip_workspace.sql
create trigger test_membership_guard before insert or update of active on public.trip_members for each row execute function private.guard_quest_membership();

insert into auth.users values ('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002'),('10000000-0000-4000-8000-000000000003');
insert into public.trips values ('20000000-0000-4000-8000-000000000001','Test trip','group',null);
insert into public.trip_members(id,trip_id,user_id,display_name,role) values
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Organiser','organizer'),
 ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','Member','member');

create function public.test_assert(ok boolean,label text) returns void language plpgsql as $$begin if not coalesce(ok,false) then raise exception 'FAILED: %',label; end if; raise notice 'PASS: %',label; end$$;
create function public.test_action(action jsonb) returns jsonb language plpgsql as $$
declare tid uuid:='20000000-0000-4000-8000-000000000001'; r integer;
begin r:=(public.get_trip_workspace(tid)->>'revision')::integer; return public.update_trip_workspace(tid,r,action,gen_random_uuid()); end$$;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
set role authenticated;
select public.test_assert((public.get_trip_workspace('20000000-0000-4000-8000-000000000001')->>'revision')::integer=0,'workspace opens without readiness or a quest');
do $$begin
  begin perform * from public.trip_workspace_responses; raise exception 'Private table was readable';
  exception when insufficient_privilege then raise notice 'PASS: direct response access denied'; end;
end$$;
reset role;
select public.test_action('{"type":"respond","kind":"budget","value":{"amount":2400},"abstain":false}');
do $$begin
  begin perform public.test_action('{"type":"confirm","kind":"budget"}'); raise exception 'Confirmed with missing response';
  exception when raise_exception then if SQLERRM not like 'Each traveller must%' then raise; end if; raise notice 'PASS: missing response does not count as consent'; end;
end$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
select public.test_assert((select r->'value'='null'::jsonb from jsonb_array_elements(public.get_trip_workspace('20000000-0000-4000-8000-000000000001')->'decisions') d cross join lateral jsonb_array_elements(d->'responses') r where d->>'kind'='budget' and r->>'memberId'='30000000-0000-4000-8000-000000000001'),'other member budget filtered server-side');
select public.test_action('{"type":"respond","kind":"budget","value":{"amount":1800},"abstain":false}');
do $$begin
  begin perform public.test_action('{"type":"confirm","kind":"budget"}'); raise exception 'Member confirmed';
  exception when insufficient_privilege then raise notice 'PASS: only organiser confirms'; end;
end$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
select public.test_action('{"type":"confirm","kind":"budget"}');
select public.test_assert((select d->'confirmed'->>'amount'='1800' from jsonb_array_elements(public.get_trip_workspace('20000000-0000-4000-8000-000000000001')->'decisions') d where d->>'kind'='budget'),'minimum budget confirmed');
select public.test_action('{"type":"respond","kind":"destination","value":{"destination":"Ipoh"},"abstain":false}');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
select public.test_action('{"type":"respond","kind":"destination","value":{"destination":"Penang"},"abstain":false}');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
do $$begin
  begin perform public.test_action('{"type":"confirm","kind":"destination"}'); raise exception 'Conflicting destination confirmed';
  exception when raise_exception then if SQLERRM not like 'Responses do not yet agree%' then raise; end if; raise notice 'PASS: disagreement is not overridden'; end;
end$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
select public.test_action('{"type":"respond","kind":"destination","value":{},"abstain":true}');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
select public.test_action('{"type":"confirm","kind":"destination"}');
insert into public.trip_quests(trip_id) values ('20000000-0000-4000-8000-000000000001');
insert into public.trip_members(id,trip_id,user_id,display_name,role) values ('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','Late member','member');
select public.test_assert((select d->>'status'='confirmed' from jsonb_array_elements(public.get_trip_workspace('20000000-0000-4000-8000-000000000001')->'decisions') d where d->>'kind'='destination'),'late join does not reopen confirmed decisions');
select public.test_action('{"type":"reopen","kind":"destination"}');
select public.test_assert((public.get_trip_workspace('20000000-0000-4000-8000-000000000001')->>'needsReview')::boolean,'reopen marks dependent plan for review');
select public.test_assert((select count(*)=1 from public.trip_workspace_history where kind='destination'),'previous confirmation retained in history');
do $$declare tid uuid:='20000000-0000-4000-8000-000000000001'; r integer; key uuid:=gen_random_uuid(); action jsonb:='{"type":"respond","kind":"dates","value":{"startsOn":"2026-09-10","endsOn":"2026-09-12"},"abstain":false}';begin
 r:=(public.get_trip_workspace(tid)->>'revision')::integer;
 perform public.update_trip_workspace(tid,r,action,key);
 perform public.update_trip_workspace(tid,r,action,key);
 perform public.test_assert((public.get_trip_workspace(tid)->>'revision')::integer=r+1,'idempotent retry does not duplicate update');
 begin perform public.update_trip_workspace(tid,r,action,gen_random_uuid()); raise exception 'Stale revision accepted';
 exception when serialization_failure then raise notice 'PASS: concurrent edit returns conflict'; end;
end$$;
select public.test_action('{"type":"place","place":{"id":"40000000-0000-4000-8000-000000000001","name":"Market","location":"Ipoh","note":"Check hours","day":null,"time":null,"sourceUrl":null}}');
select public.test_action('{"type":"build_draft","days":3}');
select public.test_assert((public.get_trip_workspace('20000000-0000-4000-8000-000000000001')->'places'->0->>'day')='1','draft can be built before group confirmation');
select public.test_assert(jsonb_array_length(public.get_trip_workspace('20000000-0000-4000-8000-000000000001')->'places')=1,'place saved before group confirmation');
do $$begin
 begin perform public.test_action('{"type":"place","place":{"id":"40000000-0000-4000-8000-000000000002","name":"Unsafe","sourceUrl":"javascript:alert(1)"}}'); raise exception 'Unsafe link accepted';
 exception when raise_exception then if SQLERRM<>'Check the place details.' then raise; end if; raise notice 'PASS: unsafe source URL rejected'; end;
end$$;
update public.trip_members set active=false where user_id='10000000-0000-4000-8000-000000000003';
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
do $$begin
 begin perform public.get_trip_workspace('20000000-0000-4000-8000-000000000001'); raise exception 'Removed member retained access';
 exception when insufficient_privilege then raise notice 'PASS: removed member denied access'; end;
end$$;
select 'Workspace database checks passed' as result;
