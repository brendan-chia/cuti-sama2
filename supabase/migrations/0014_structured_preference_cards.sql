alter table public.preference_submissions add column if not exists choice_id text;
alter table public.preference_submissions add column if not exists custom_text text;
alter table public.preference_submissions add column if not exists pace_value smallint;
update public.preference_submissions set choice_id = 'legacy' where choice_id is null;
alter table public.preference_submissions alter column choice_id set not null;
alter table public.preference_submissions alter column choice_id set default 'legacy';
alter table public.preference_submissions add constraint preference_choice_id_format check (choice_id ~ '^[a-z0-9_]{2,40}$');
alter table public.preference_submissions add constraint preference_custom_text_length check (custom_text is null or char_length(btrim(custom_text)) between 1 and 60);
alter table public.preference_submissions add constraint preference_pace_value_range check (pace_value is null or pace_value between 0 and 4);

create or replace function public.get_preference_room(p_trip_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare caller_member public.trip_members%rowtype; current_round public.preference_rounds%rowtype; result jsonb;
begin
  select member.* into caller_member from public.trip_members member where member.trip_id = p_trip_id and member.user_id = (select auth.uid()) and member.active;
  if caller_member.id is null then raise exception using errcode = '42501', message = 'Trip Room access is unavailable.'; end if;
  if not exists (select 1 from public.trips trip where trip.id = p_trip_id and trip.constraints_locked_at is not null) then raise exception using errcode = '22023', message = 'Constraints must be locked before preference rounds begin.'; end if;
  select round.* into current_round from public.preference_rounds round where round.trip_id = p_trip_id and round.sequence <= 3 order by round.sequence desc limit 1;
  select jsonb_build_object(
    'tripId', trip.id, 'tripName', trip.name, 'currentMemberId', caller_member.id, 'currentRole', caller_member.role,
    'complete', coalesce(current_round.sequence = 3 and current_round.closed_at is not null, false),
    'currentRound', case when current_round.id is null then null else jsonb_build_object(
      'roundId', current_round.id, 'sequence', current_round.sequence, 'kind', current_round.kind,
      'status', case when current_round.closed_at is not null then 'closed' when current_round.revealed_at is not null then 'revealed' else 'collecting' end,
      'createdAt', current_round.created_at, 'revealedAt', current_round.revealed_at, 'closedAt', current_round.closed_at,
      'participantCount', (select count(*) from public.preference_round_participants participant where participant.round_id = current_round.id and participant.removed_at is null),
      'submittedCount', (select count(*) from public.preference_round_participants participant join public.preference_submissions submission on submission.round_id = participant.round_id and submission.member_id = participant.member_id where participant.round_id = current_round.id and participant.removed_at is null),
      'participants', coalesce((select jsonb_agg(jsonb_build_object('memberId', member.id, 'displayName', member.display_name, 'discriminator', member.display_name_discriminator, 'submitted', submission.member_id is not null, 'removed', participant.removed_at is not null) order by participant.joined_snapshot_at) from public.preference_round_participants participant join public.trip_members member on member.id = participant.member_id left join public.preference_submissions submission on submission.round_id = participant.round_id and submission.member_id = participant.member_id where participant.round_id = current_round.id), '[]'::jsonb),
      'ownSubmission', (select jsonb_build_object('choiceId', submission.choice_id, 'customText', submission.custom_text, 'value', submission.value, 'updatedAt', submission.updated_at) from public.preference_submissions submission where submission.round_id = current_round.id and submission.member_id = caller_member.id),
      'revealedSubmissions', case when current_round.revealed_at is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('memberId', member.id, 'displayName', member.display_name, 'discriminator', member.display_name_discriminator, 'choiceId', submission.choice_id, 'customText', submission.custom_text, 'value', submission.value, 'updatedAt', submission.updated_at) order by submission.submitted_at) from public.preference_submissions submission join public.trip_members member on member.id = submission.member_id join public.preference_round_participants participant on participant.round_id = submission.round_id and participant.member_id = submission.member_id and participant.removed_at is null where submission.round_id = current_round.id), '[]'::jsonb) end
    ) end
  ) into result from public.trips trip where trip.id = p_trip_id;
  return result;
end; $$;

create or replace function public.submit_structured_preference_card(p_trip_id uuid, p_round_id uuid, p_round_type text, p_choice_id text, p_custom_text text, p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare caller_member public.trip_members%rowtype; target_round public.preference_rounds%rowtype; display_value text; pace smallint;
begin
  if p_idempotency_key is null or p_choice_id !~ '^[a-z0-9_]{2,40}$' then raise exception using errcode = '22023', message = 'Preference card is invalid.'; end if;
  select round.* into target_round from public.preference_rounds round where round.id = p_round_id and round.trip_id = p_trip_id for update;
  if target_round.id is null then raise exception using errcode = 'P0002', message = 'Preference round was not found.'; end if;
  if target_round.kind::text <> p_round_type then raise exception using errcode = '22023', message = 'This card does not belong to the current round.'; end if;
  if target_round.revealed_at is not null or target_round.closed_at is not null then raise exception using errcode = '22023', message = 'This preference round has already been revealed.'; end if;
  if (p_round_type = 'vibe' and p_choice_id not in ('quiet','chill','lively','adventurous','balanced')) or (p_round_type = 'pace' and p_choice_id not in ('slow_easy','balanced','packed','spontaneous')) or (p_round_type = 'must_have' and p_choice_id not in ('food_hunt','nature','culture','adventure','nightlife','shopping','wellness','custom')) then raise exception using errcode = '22023', message = 'This preference card is unsupported.'; end if;
  if p_choice_id = 'custom' then
    p_custom_text := btrim(coalesce(p_custom_text, ''));
    if p_round_type <> 'must_have' or char_length(p_custom_text) not between 1 and 60 or p_custom_text ~ '[[:cntrl:]]' then raise exception using errcode = '22023', message = 'Custom Must-Have must be one valid experience of 60 characters or fewer.'; end if;
    display_value := p_custom_text;
  else
    if p_custom_text is not null then raise exception using errcode = '22023', message = 'Custom text is only allowed on a custom Must-Have.'; end if;
    display_value := case p_choice_id
      when 'quiet' then 'Quiet — peaceful places, privacy and fewer crowds' when 'chill' then 'Chill — slow mornings, flexible plans and downtime' when 'lively' then 'Lively — markets, events, busy streets and nightlife' when 'adventurous' then 'Adventurous — exploration and energetic activities'
      when 'slow_easy' then 'Slow & Easy — 1–2 main activities with generous rest time' when 'balanced' then case when p_round_type = 'pace' then 'Balanced — 2–3 activities with planned breaks' else 'Balanced — rest, exploration and social time' end when 'packed' then 'Packed — several activities, earlier starts and fuller days' when 'spontaneous' then 'Spontaneous — fewer bookings and more flexible decisions'
      when 'food_hunt' then 'Food Hunt' when 'nature' then 'Nature' when 'culture' then 'Culture' when 'adventure' then 'Adventure' when 'nightlife' then 'Nightlife' when 'shopping' then 'Shopping' when 'wellness' then 'Wellness' end;
  end if;
  pace := case p_choice_id when 'spontaneous' then 0 when 'slow_easy' then 1 when 'balanced' then 2 when 'packed' then 4 else null end;
  select member.* into caller_member from public.trip_members member join public.preference_round_participants participant on participant.member_id = member.id and participant.round_id = p_round_id and participant.removed_at is null where member.trip_id = p_trip_id and member.user_id = (select auth.uid()) and member.active;
  if caller_member.id is null then raise exception using errcode = '42501', message = 'You are not an active participant in this round.'; end if;
  insert into public.preference_submissions (round_id, member_id, value, choice_id, custom_text, pace_value) values (p_round_id, caller_member.id, display_value, p_choice_id, case when p_choice_id = 'custom' then p_custom_text else null end, pace)
  on conflict (round_id, member_id) do update set value = excluded.value, choice_id = excluded.choice_id, custom_text = excluded.custom_text, pace_value = excluded.pace_value, updated_at = now();
  perform private.maybe_reveal_preference_round(p_round_id);
  return public.get_preference_room(p_trip_id);
end; $$;

create or replace function public.manage_preference_round(p_trip_id uuid, p_action text, p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target_trip public.trips%rowtype; current_round public.preference_rounds%rowtype; next_round_id uuid; next_kind public.preference_round_kind;
begin
  if p_idempotency_key is null or p_action not in ('start', 'close', 'advance') then raise exception using errcode = '22023', message = 'Round action is invalid.'; end if;
  if not (select private.is_trip_organizer(p_trip_id)) then raise exception using errcode = '42501', message = 'Only the organiser can manage preference rounds.'; end if;
  select trip.* into target_trip from public.trips trip where trip.id = p_trip_id for update;
  if target_trip.constraints_locked_at is null then raise exception using errcode = '22023', message = 'Constraints must be locked before preference rounds begin.'; end if;
  select round.* into current_round from public.preference_rounds round where round.trip_id = p_trip_id and round.sequence <= 3 order by round.sequence desc limit 1 for update;
  if p_action = 'start' then
    if current_round.id is not null then raise exception using errcode = '22023', message = 'Preference rounds have already started.'; end if;
    insert into public.preference_rounds (trip_id, sequence, kind) values (p_trip_id, 1, 'vibe') returning id into next_round_id;
    insert into public.preference_round_participants (round_id, member_id) select next_round_id, member.id from public.trip_members member where member.trip_id = p_trip_id and member.active;
  elsif p_action = 'close' then
    if current_round.id is null or current_round.closed_at is not null then raise exception using errcode = '22023', message = 'There is no open round to close.'; end if;
    update public.preference_rounds set revealed_at = coalesce(revealed_at, now()), closed_at = now() where id = current_round.id;
  else
    if current_round.id is null or current_round.closed_at is null then raise exception using errcode = '22023', message = 'Close the current round before advancing.'; end if;
    if current_round.sequence >= 3 then raise exception using errcode = '22023', message = 'All preference rounds are complete.'; end if;
    next_kind := (case current_round.sequence + 1 when 2 then 'pace' else 'must_have' end)::public.preference_round_kind;
    insert into public.preference_rounds (trip_id, sequence, kind) values (p_trip_id, current_round.sequence + 1, next_kind) returning id into next_round_id;
    insert into public.preference_round_participants (round_id, member_id) select next_round_id, member.id from public.trip_members member where member.trip_id = p_trip_id and member.active;
  end if;
  return public.get_preference_room(p_trip_id);
end; $$;

revoke all on function public.submit_structured_preference_card(uuid, uuid, text, text, text, uuid) from public, anon;
grant execute on function public.submit_structured_preference_card(uuid, uuid, text, text, text, uuid) to authenticated;
