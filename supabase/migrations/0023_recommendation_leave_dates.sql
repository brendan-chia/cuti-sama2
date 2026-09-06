-- Add exact leave dates to current saved recommendations using their original
-- holiday snapshot and the unchanged member preferences for that revision.
update public.trip_quests q
set date_recommendation = jsonb_set(q.date_recommendation, '{periods}', (
  select coalesce(jsonb_agg(jsonb_set(p.value, '{travellers}', (
    select coalesce(jsonb_agg(t.value || jsonb_build_object('leaveDates', (
      select coalesce(jsonb_agg(to_char((p.value->>'startsOn')::date + n, 'YYYY-MM-DD') order by n), '[]'::jsonb)
      from generate_series(0, (p.value->>'endsOn')::date - (p.value->>'startsOn')::date) n
      where not coalesce(i.date_preferences->'daysOff', '[0,6]'::jsonb) @> to_jsonb(extract(dow from (p.value->>'startsOn')::date + n)::integer)
        and not exists (select 1 from jsonb_array_elements(p.value->'holidays') h where h->>'date' = to_char((p.value->>'startsOn')::date + n, 'YYYY-MM-DD'))
    )) order by t.ordinality), '[]'::jsonb)
    from jsonb_array_elements(p.value->'travellers') with ordinality t(value, ordinality)
    join public.trip_quest_inputs i on i.trip_id = q.trip_id and i.member_id = (t.value->>'memberId')::uuid
  )) order by p.ordinality), '[]'::jsonb)
  from jsonb_array_elements(q.date_recommendation->'periods') with ordinality p(value, ordinality)
))
where q.recommendation_revision = q.revision
  and q.date_recommendation is not null
  and q.date_recommendation->>'calendarVersion' = (select version from public.national_holiday_calendar where id = 1);
