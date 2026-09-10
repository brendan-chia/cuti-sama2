-- Additive workspace: legacy quest and itinerary data remain untouched.
-- All writes serialize on the trip row, the same lock used by membership changes.
create table public.trip_workspaces (
  trip_id uuid primary key references public.trips(id) on delete cascade,
  revision integer not null default 0,
  places jsonb not null default '[]', bookings jsonb not null default '[]',
  needs_review boolean not null default false, updated_at timestamptz not null default now()
);
create table public.trip_workspace_decisions (
  trip_id uuid references public.trips(id) on delete cascade,
  kind text check (kind in ('dates','destination','budget')),
  version integer not null default 1,
  confirmed jsonb, previous jsonb,
  confirmed_by uuid references public.trip_members(id), confirmed_at timestamptz,
  confirmed_participants uuid[],
  primary key(trip_id,kind)
);
create table public.trip_workspace_responses (
  trip_id uuid, kind text, version integer, member_id uuid references public.trip_members(id),
  value jsonb not null, abstain boolean not null default false,
  primary key(trip_id,kind,version,member_id),
  foreign key(trip_id,kind) references public.trip_workspace_decisions(trip_id,kind) on delete cascade
);
create table public.trip_workspace_history (
  trip_id uuid references public.trips(id) on delete cascade, kind text, version integer,
  value jsonb not null, actor uuid references public.trip_members(id), participants uuid[], recorded_at timestamptz not null default now(),
  primary key(trip_id,kind,version)
);
create table public.trip_workspace_operations (
  trip_id uuid references public.trips(id) on delete cascade, user_id uuid references auth.users(id),
  key uuid, request jsonb not null, primary key(trip_id,user_id,key)
);
alter table public.trip_workspaces enable row level security;
alter table public.trip_workspace_decisions enable row level security;
alter table public.trip_workspace_responses enable row level security;
alter table public.trip_workspace_history enable row level security;
alter table public.trip_workspace_operations enable row level security;
revoke all on public.trip_workspaces, public.trip_workspace_decisions, public.trip_workspace_responses,
  public.trip_workspace_history, public.trip_workspace_operations from public, anon, authenticated;

create function public.get_trip_workspace(p_trip_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare m public.trip_members%rowtype; t public.trips%rowtype; w public.trip_workspaces%rowtype;
  first_open boolean; q public.trip_quests%rowtype; budget_amount integer;
begin
  select * into t from public.trips where id=p_trip_id for update;
  select * into m from public.trip_members where trip_id=p_trip_id and user_id=auth.uid() and active;
  if m.id is null then raise exception using errcode='42501',message='You no longer have access to this trip.'; end if;
  insert into public.trip_workspaces(trip_id) values(p_trip_id) on conflict do nothing returning true into first_open;
  insert into public.trip_workspace_decisions(trip_id,kind)
    select p_trip_id,kind from unnest(array['dates','destination','budget']) kind on conflict do nothing;
  if first_open then
    -- Preserve confirmed outcomes, never fabricate individual responses for a legacy trip.
    select * into q from public.trip_quests where trip_id=p_trip_id;
    if q.period is not null then
      update public.trip_workspace_decisions set confirmed=jsonb_build_object('startsOn',q.period->>'startsOn','endsOn',q.period->>'endsOn') where trip_id=p_trip_id and kind='dates';
    end if;
    if q.selected_country_code is not null then
      update public.trip_workspace_decisions set confirmed=jsonb_build_object('destination',case q.selected_country_code
        when 'MY' then 'Malaysia' when 'TH' then 'Thailand' when 'ID' then 'Indonesia' when 'VN' then 'Vietnam'
        when 'JP' then 'Japan' when 'KR' then 'South Korea' when 'SG' then 'Singapore' when 'TW' then 'Taiwan'
        when 'PH' then 'Philippines' when 'KH' then 'Cambodia' when 'LA' then 'Laos' when 'IN' then 'India'
        when 'LK' then 'Sri Lanka' when 'NP' then 'Nepal' when 'AU' then 'Australia' when 'NZ' then 'New Zealand'
        when 'GB' then 'United Kingdom' when 'FR' then 'France' when 'IT' then 'Italy' when 'ES' then 'Spain'
        when 'TR' then 'Türkiye' when 'AE' then 'United Arab Emirates' when 'US' then 'United States' when 'CA' then 'Canada'
        else q.selected_country_code end) where trip_id=p_trip_id and kind='destination';
    end if;
    if q.stage in ('logistics','complete') then
      select min(i.budget) into budget_amount from public.trip_quest_inputs i join public.trip_members rm on rm.id=i.member_id where i.trip_id=p_trip_id and rm.active;
      if budget_amount is not null then update public.trip_workspace_decisions set confirmed=jsonb_build_object('amount',budget_amount) where trip_id=p_trip_id and kind='budget'; end if;
    end if;
    update public.trip_workspace_decisions set confirmed_at=now(),confirmed_participants=(select array_agg(id order by id) from public.trip_members where trip_id=p_trip_id and active)
      where trip_id=p_trip_id and confirmed is not null;
    insert into public.trip_workspace_history(trip_id,kind,version,value,participants)
      select trip_id,kind,version,confirmed,confirmed_participants from public.trip_workspace_decisions where trip_id=p_trip_id and confirmed is not null;
  end if;
  select * into w from public.trip_workspaces where trip_id=p_trip_id;
  return jsonb_build_object('tripId',t.id,'tripName',t.name,'travelParty',t.travel_party,
    'currentMemberId',m.id,'currentRole',m.role,'revision',w.revision,'updatedAt',w.updated_at,
    'needsReview',w.needs_review,'legacyStarted',t.planning_started_at is not null,
    'places',w.places,'bookings',w.bookings,
    'members',(select jsonb_agg(jsonb_build_object('memberId',id,'name',display_name,'role',role) order by created_at,id)
      from public.trip_members where trip_id=p_trip_id and active),
    'decisions',(select jsonb_agg(jsonb_build_object('kind',d.kind,'version',d.version,
      'status',case when d.confirmed is null then 'collecting' else 'confirmed' end,
      'confirmed',d.confirmed,'previous',d.previous,
      'responses',(select coalesce(jsonb_agg(jsonb_build_object('memberId',r.member_id,'abstain',r.abstain,
        'value',case when d.kind='budget' and r.member_id<>m.id then null else r.value end)), '[]')
        from public.trip_workspace_responses r join public.trip_members rm on rm.id=r.member_id
        where r.trip_id=d.trip_id and r.kind=d.kind and r.version=d.version and rm.active)) order by d.kind)
      from public.trip_workspace_decisions d where d.trip_id=p_trip_id));
end $$;

create function public.update_trip_workspace(p_trip_id uuid,p_revision integer,p_action jsonb,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.trip_members%rowtype; w public.trip_workspaces%rowtype;
  d public.trip_workspace_decisions%rowtype; op text:=p_action->>'type'; k text:=p_action->>'kind';
  v jsonb; old_request jsonb; req jsonb; response_count integer; member_count integer;
  chosen jsonb; start_date date; end_date date; amount numeric; item_id uuid;
begin
  perform public.get_trip_workspace(p_trip_id);
  select * into m from public.trip_members where trip_id=p_trip_id and user_id=auth.uid() and active;
  select * into w from public.trip_workspaces where trip_id=p_trip_id;
  if p_key is null or p_revision is null or jsonb_typeof(p_action) is distinct from 'object' then raise exception 'Invalid workspace request.'; end if;
  req:=jsonb_build_object('revision',p_revision,'action',p_action);
  select request into old_request from public.trip_workspace_operations where trip_id=p_trip_id and user_id=auth.uid() and key=p_key;
  if found then
    if old_request<>req then raise exception 'This request key was already used for different changes.'; end if;
    return public.get_trip_workspace(p_trip_id);
  end if;
  if w.revision<>p_revision then raise exception using errcode='40001',message='This trip changed while you were editing. Review the latest version before saving again.'; end if;
  if op in ('respond','confirm','reopen') then
    select * into d from public.trip_workspace_decisions where trip_id=p_trip_id and kind=k;
    if d.kind is null then raise exception 'Unknown decision.'; end if;
    if op='respond' then
      if d.confirmed is not null then raise exception 'Reopen this decision before changing responses.'; end if;
      if jsonb_typeof(p_action->'abstain') is distinct from 'boolean' then raise exception 'Choose a response or explicit abstention.'; end if;
      v:=p_action->'value';
      if jsonb_typeof(v) is distinct from 'object' then raise exception 'Invalid response.'; end if;
      if (p_action->>'abstain')::boolean then v:='{}';
      elsif k='destination' then
        if char_length(btrim(coalesce(v->>'destination',''))) not between 1 and 120 then raise exception 'Enter a destination.'; end if;
        v:=jsonb_build_object('destination',btrim(v->>'destination'));
      elsif k='dates' then
        start_date:=(v->>'startsOn')::date; end_date:=(v->>'endsOn')::date;
        if start_date is null or end_date is null or end_date-start_date not between 0 and 29 then raise exception 'Choose a trip of 1 to 30 days.'; end if;
        v:=jsonb_build_object('startsOn',start_date::text,'endsOn',end_date::text);
      elsif k='budget' then
        if jsonb_typeof(v->'amount') is distinct from 'number' then raise exception 'Enter a whole MYR amount.'; end if;
        amount:=(v->>'amount')::numeric;
        if amount not between 1 and 1000000 or amount<>trunc(amount) then raise exception 'Enter a whole MYR amount from 1 to 1,000,000.'; end if;
        v:=jsonb_build_object('amount',amount);
      end if;
      insert into public.trip_workspace_responses(trip_id,kind,version,member_id,value,abstain)
        values(p_trip_id,k,d.version,m.id,v,(p_action->>'abstain')::boolean)
        on conflict(trip_id,kind,version,member_id) do update set value=excluded.value,abstain=excluded.abstain;
    else
      if m.role<>'organizer' then raise exception using errcode='42501',message='Only the organiser can confirm or reopen a decision.'; end if;
      if op='reopen' then
        if d.confirmed is null then raise exception 'This decision is already open.'; end if;
        update public.trip_workspace_decisions set version=version+1,previous=confirmed,confirmed=null,confirmed_at=null,confirmed_by=null where trip_id=p_trip_id and kind=k;
        update public.trip_workspaces set needs_review=true where trip_id=p_trip_id;
      else
        if d.confirmed is not null then raise exception 'This decision is already confirmed.'; end if;
        select count(*) into member_count from public.trip_members where trip_id=p_trip_id and active;
        select count(*) into response_count from public.trip_workspace_responses r join public.trip_members rm on rm.id=r.member_id
          where r.trip_id=p_trip_id and r.kind=k and r.version=d.version and rm.active;
        if response_count<>member_count then raise exception 'Each traveller must respond or explicitly abstain before confirmation. You can keep working on the draft.'; end if;
        if k='budget' then
          select jsonb_build_object('amount',min((r.value->>'amount')::numeric)) into chosen from public.trip_workspace_responses r join public.trip_members rm on rm.id=r.member_id
            where r.trip_id=p_trip_id and r.kind=k and r.version=d.version and rm.active and not r.abstain;
          if chosen->>'amount' is null then raise exception 'At least one budget is needed.'; end if;
        else
          select count(distinct r.value) into response_count from public.trip_workspace_responses r join public.trip_members rm on rm.id=r.member_id
            where r.trip_id=p_trip_id and r.kind=k and r.version=d.version and rm.active and not r.abstain;
          if response_count<>1 then raise exception 'Responses do not yet agree. Ask travellers to revise their choices; no response will be overridden.'; end if;
          select r.value into chosen from public.trip_workspace_responses r join public.trip_members rm on rm.id=r.member_id
            where r.trip_id=p_trip_id and r.kind=k and r.version=d.version and rm.active and not r.abstain limit 1;
        end if;
        update public.trip_workspace_decisions set confirmed=chosen,confirmed_by=m.id,confirmed_at=now(),
          confirmed_participants=(select array_agg(id order by id) from public.trip_members where trip_id=p_trip_id and active)
          where trip_id=p_trip_id and kind=k;
        insert into public.trip_workspace_history(trip_id,kind,version,value,actor,participants)
          select p_trip_id,k,d.version,chosen,m.id,confirmed_participants from public.trip_workspace_decisions where trip_id=p_trip_id and kind=k;
      end if;
    end if;
  elsif op='place' then
    v:=p_action->'place'; item_id:=(v->>'id')::uuid;
    if item_id is null or char_length(btrim(coalesce(v->>'name',''))) not between 1 and 160
      or char_length(coalesce(v->>'location',''))>240 or char_length(coalesce(v->>'note',''))>1200
      or ((v->>'day') is not null and (v->>'day')::integer not between 1 and 30)
      or ((v->>'time') is not null and (v->>'time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
      or ((v->>'time') is not null and (v->>'day') is null)
      or ((v->>'sourceUrl') is not null and ((v->>'sourceUrl') !~ '^https?://' or char_length(v->>'sourceUrl')>2000)) then raise exception 'Check the place details.'; end if;
    if jsonb_array_length(w.places)>=160 and not exists(select 1 from jsonb_array_elements(w.places) p where p->>'id'=item_id::text) then raise exception 'Save up to 160 places per trip.'; end if;
    if exists(select 1 from jsonb_array_elements(w.places) p where p->>'id'<>item_id::text and lower(btrim(p->>'name'))=lower(btrim(v->>'name')) and lower(btrim(p->>'location'))=lower(btrim(v->>'location'))) then raise exception 'This place is already saved. Edit the existing place.'; end if;
    v:=jsonb_build_object('id',item_id,'name',btrim(v->>'name'),'location',coalesce(v->>'location',''),'note',coalesce(v->>'note',''),'day',(v->>'day')::integer,'time',v->>'time','sourceUrl',v->>'sourceUrl');
    update public.trip_workspaces set places=(select coalesce(jsonb_agg(p),'[]') from jsonb_array_elements(w.places) p where p->>'id'<>item_id::text)||jsonb_build_array(v) where trip_id=p_trip_id;
  elsif op='booking' then
    if m.role<>'organizer' then raise exception using errcode='42501',message='Only the organiser can update shared bookings.'; end if;
    v:=p_action->'booking'; item_id:=(v->>'id')::uuid;
    if item_id is null or char_length(btrim(coalesce(v->>'title',''))) not between 1 and 160
      or coalesce(v->>'kind','') not in ('transport','stay') or coalesce(v->>'status','') not in ('selected','booked')
      or char_length(coalesce(v->>'note',''))>1200
      or (v->>'cost' is not null and (v->>'cost')::numeric not between 0 and 10000000)
      or (v->>'url' is not null and ((v->>'url') !~ '^https?://' or char_length(v->>'url')>2000)) then raise exception 'Check the booking details.'; end if;
    if jsonb_array_length(w.bookings)>=50 and not exists(select 1 from jsonb_array_elements(w.bookings) p where p->>'id'=item_id::text) then raise exception 'Save up to 50 bookings.'; end if;
    v:=jsonb_build_object('id',item_id,'title',btrim(v->>'title'),'kind',v->>'kind','status',v->>'status','note',coalesce(v->>'note',''),'cost',(v->>'cost')::numeric,'url',v->>'url');
    update public.trip_workspaces set bookings=(select coalesce(jsonb_agg(p),'[]') from jsonb_array_elements(w.bookings) p where p->>'id'<>item_id::text)||jsonb_build_array(v) where trip_id=p_trip_id;
  elsif op in ('remove_place','remove_booking') then
    item_id:=(p_action->>'id')::uuid;
    if item_id is null then raise exception 'Choose an item to remove.'; end if;
    if op='remove_place' then
      update public.trip_workspaces set places=(select coalesce(jsonb_agg(p),'[]') from jsonb_array_elements(w.places) p where p->>'id'<>item_id::text) where trip_id=p_trip_id;
    else
      if m.role<>'organizer' then raise exception using errcode='42501',message='Only the organiser can remove shared bookings.'; end if;
      update public.trip_workspaces set bookings=(select coalesce(jsonb_agg(p),'[]') from jsonb_array_elements(w.bookings) p where p->>'id'<>item_id::text) where trip_id=p_trip_id;
    end if;
  elsif op='build_draft' then
    if m.role<>'organizer' then raise exception using errcode='42501',message='Only the organiser can build the shared draft.'; end if;
    if jsonb_typeof(p_action->'days') is distinct from 'number' or (p_action->>'days')::numeric<>trunc((p_action->>'days')::numeric)
      or (p_action->>'days')::integer not between 1 and 30 then raise exception 'Choose 1 to 30 days.'; end if;
    if not exists(select 1 from jsonb_array_elements(w.places) p where p->>'day' is null) then raise exception 'Add unscheduled places before building a draft.'; end if;
    -- Schedule only unscheduled places, in saved order. Keep all existing day/time assignments.
    -- This is a provisional outline, not a claim of route optimisation or checked opening hours.
    update public.trip_workspaces set places=(select jsonb_agg(case when p->>'day' is null then
      p || jsonb_build_object('day',1+mod(n-1,(p_action->>'days')::integer),'time',null) else p end order by position)
      from (select p,position,count(*) filter(where p->>'day' is null) over(order by position) as n
        from jsonb_array_elements(w.places) with ordinality as places(p,position)) numbered)
      where trip_id=p_trip_id;
  elsif op='reviewed' then
    if m.role<>'organizer' then raise exception using errcode='42501',message='Only the organiser can mark the plan reviewed.'; end if;
    update public.trip_workspaces set needs_review=false where trip_id=p_trip_id;
  else raise exception 'Unknown workspace action.';
  end if;
  update public.trip_workspaces set revision=revision+1,updated_at=now() where trip_id=p_trip_id;
  insert into public.trip_workspace_operations(trip_id,user_id,key,request) values(p_trip_id,auth.uid(),p_key,req);
  return public.get_trip_workspace(p_trip_id);
end $$;
revoke all on function public.get_trip_workspace(uuid),public.update_trip_workspace(uuid,integer,jsonb,uuid) from public,anon;
grant execute on function public.get_trip_workspace(uuid),public.update_trip_workspace(uuid,integer,jsonb,uuid) to authenticated;

-- Late joiners participate in open workspace decisions, not in historical quest ballots.
-- Existing quest-only trips retain their original membership boundary until opened as a workspace.
create or replace function private.guard_quest_membership()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.trips where id=new.trip_id for update;
  if new.active and (tg_op='INSERT' or not old.active)
    and exists(select 1 from public.trip_quests where trip_id=new.trip_id)
    and not exists(select 1 from public.trip_workspaces where trip_id=new.trip_id) then
    raise exception using errcode='22023',message='This trip has started its planning quest. Joining is closed.';
  end if;
  return new;
end $$;
create or replace function private.guard_quest_invitation()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.trips where id=new.trip_id for update;
  if new.revoked_at is null and exists(select 1 from public.trip_quests where trip_id=new.trip_id)
    and not exists(select 1 from public.trip_workspaces where trip_id=new.trip_id) then
    raise exception using errcode='22023',message='Invitations are closed while this trip is on its planning quest.';
  end if;
  return new;
end $$;
