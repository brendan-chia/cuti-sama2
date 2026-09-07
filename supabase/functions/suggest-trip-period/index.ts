import { llmConfig } from '../_shared/llm.ts';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { DateRecommendationSchema, QuestRoomSchema } from '../../../packages/contracts/src/quest.ts';
import { buildCombinedCandidates, DateInputSchema, recommendationPeriod } from '../../../packages/contracts/src/combined-dates.ts';
import { authenticatedClient, corsHeaders, json, requestJson } from '../_shared/invites.ts';
import { rankCombinedDates } from './combined-groq.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  try {
    const client = await authenticatedClient(request);
    if (!client) return json({ error: 'Member session is invalid or expired.' }, 401);
    const payload = z.object({ tripId: z.uuid() }).strict().safeParse(await requestJson(request));
    if (!payload.success) return json({ error: 'Choose a valid trip.' }, 400);
    const { data, error } = await client.rpc('get_trip_quest', { p_trip_id: payload.data.tripId });
    if (error) return json({ error: 'Could not access this trip.' }, 403);
    const room = QuestRoomSchema.parse(data);
    if (room.currentRole !== 'organizer') return json({ error: 'The organiser finds dates for the crew.' }, 403);
    if (room.stage !== 'timing') return json({ error: 'The trip dates are already confirmed.' }, 409);
    if (room.members.some((member) => !member.availabilitySubmitted)) return json({ error: 'Wait for everyone to submit their preferences.' }, 409);
    if (room.dateRecommendation) return json(room);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    // Private exclusions are used only by the calendar engine, never sent to DeepSeek or other travellers.
    const [inputResult, calendarResult] = await Promise.all([
      admin.from('trip_quest_inputs').select('member_id, starts_on, ends_on, date_preferences').eq('trip_id', room.tripId).in('member_id', room.members.map((member) => member.memberId)),
      admin.from('national_holiday_calendar').select('*').eq('id', 1).single(),
    ]);
    if (inputResult.error || calendarResult.error || !inputResult.data || !calendarResult.data) throw new Error('Calendar data unavailable');
    const inputs = inputResult.data.map((input) => DateInputSchema.parse({ memberId: input.member_id, startsOn: input.starts_on, endsOn: input.ends_on, preferences: input.date_preferences }));
    if (inputs.length !== room.members.length) throw new Error('Incomplete inputs');
    const calendar = calendarResult.data;
    const holidays = z.array(z.object({ date: z.iso.date(), name: z.string() }).strict()).parse(calendar.holidays);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const candidates = buildCombinedCandidates(inputs, holidays, today);
    const years = new Set<number>();
    for (const candidate of candidates) for (let year = Number(candidate.startsOn.slice(0, 4)); year <= Number(candidate.endsOn.slice(0, 4)); year++) years.add(year);
    const missing = [...years].filter((year) => !calendar.covered_years.includes(year));
    const ranked = await rankCombinedDates(candidates);
    const recommendation = DateRecommendationSchema.parse({
      periods: (ranked ?? candidates.slice(0, 3)).map(recommendationPeriod),
      source: ranked ? llmConfig().provider : 'calendar', calendarVersion: calendar.version,
      calendarNotice: `${calendar.notice}${missing.length ? ` Holiday data for ${missing.join(', ')} is not loaded; leave estimates for those years use usual days off only.` : ''}`,
      message: !candidates.length
        ? 'No period fits everyone’s flexibility and unavailable dates. Widen your flexibility or review your unavailable dates, then save your preferences again.'
        : ranked ? 'AI compared your crew’s preferences and verified calendar facts to recommend these shared dates.'
          : 'AI ranking is unavailable. These calculated options preserve trip length where possible and prioritise fair leave estimates.',
    });
    const saved = await admin.rpc('save_date_recommendation', { p_trip_id: room.tripId, p_member_id: room.currentMemberId, p_revision: room.revision, p_recommendation: recommendation });
    if (saved.error) throw new Error('Recommendation could not be saved');
    const fresh = await client.rpc('get_trip_quest', { p_trip_id: room.tripId });
    if (fresh.error) throw new Error('Could not reload the trip');
    const next = QuestRoomSchema.parse(fresh.data);
    if (!next.dateRecommendation) return json({ error: 'Someone updated the trip while dates were being calculated. Please try again.' }, 409);
    return json(next);
  } catch { return json({ error: 'Could not recommend dates. Please try again.' }, 500); }
});
