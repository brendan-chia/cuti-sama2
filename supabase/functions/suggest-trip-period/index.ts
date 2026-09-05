import { QuestRoomSchema } from '../../../packages/contracts/src/quest.ts';
import { asTripPeriod, buildTripPeriodCandidates, TripPeriodRequestSchema } from '../../../packages/contracts/src/trip-period.ts';
import { authenticatedClient, corsHeaders, json, requestJson } from '../_shared/invites.ts';
import { requestGroqTripPeriods } from './groq.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  let client;
  try { client = await authenticatedClient(request); } catch { return json({ error: 'Function configuration is incomplete.' }, 500); }
  if (!client) return json({ error: 'Member session is invalid or expired.' }, 401);
  const payload = TripPeriodRequestSchema.safeParse(await requestJson(request));
  if (!payload.success) return json({ error: 'Choose a trip and a duration from 2 to 14 days.' }, 400);

  // This member-scoped RPC enforces active membership and exposes only the
  // shared date intersection. No private member dates reach the AI provider.
  const { data, error } = await client.rpc('get_trip_quest', { p_trip_id: payload.data.tripId });
  if (error) return json({ error: 'Could not access this trip. Reopen the room and try again.' }, error.code === '42501' ? 403 : 500);
  const room = QuestRoomSchema.safeParse(data);
  if (!room.success) return json({ error: 'Could not read the group calendar. Reopen the room and try again.' }, 500);
  if (room.data.currentRole !== 'organizer') return json({ error: 'The organizer suggests the group trip dates.' }, 403);
  if (room.data.stage !== 'timing') return json({ error: 'The group has already chosen its trip dates.' }, 409);
  const missing = room.data.members.filter((member) => !member.availabilitySubmitted).length;
  if (missing) return json({ periods: [], source: 'calendar', message: `Waiting for ${missing} ${missing === 1 ? 'traveler' : 'travelers'} to share available dates. Everyone needs to join the calendar before suggestions unlock.` });
  const candidates = buildTripPeriodCandidates(room.data.sharedAvailability, payload.data.durationDays);
  if (!candidates.length) return json({
    periods: [], source: 'calendar',
    message: room.data.sharedAvailability
      ? `Your shared dates do not fit a future ${payload.data.durationDays}-day trip. Try a shorter trip or ask everyone to widen their available dates.`
      : 'Your available dates do not overlap yet. Ask everyone to update their dates so you share a window of at least two days.',
  });
  const aiPeriods = await requestGroqTripPeriods(candidates);
  return json({
    periods: aiPeriods ?? candidates.slice(0, 3).map(asTripPeriod),
    source: aiPeriods ? 'groq' : 'calendar',
    message: aiPeriods
      ? 'AI ranked these options using your shared dates and Saturday–Sunday weekend coverage.'
      : 'Calendar suggestions from everyone’s shared dates, prioritizing Saturday–Sunday weekends.',
  });
});
