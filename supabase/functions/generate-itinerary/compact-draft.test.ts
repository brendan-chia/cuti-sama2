import { compactItineraryJsonSchema, expandItineraryDraft } from '../_shared/itinerary-draft.ts';
import { AiItinerarySchema, ItineraryGenerationError, requestAiItinerary } from '../_shared/groq.ts';
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const timestamp = '2026-09-07T12:00:00.123456+00:00';
const context = { destination: { name: 'South Korea', country: 'South Korea' }, dates: { startsOn: '2026-09-13', endsOn: '2026-09-13' }, hardConstraints: { currency: 'MYR' }, sourceTimestamps: [timestamp], selectedPlaces: [{ id: 'kr-palace', name: 'Palace', latitude: 37.58, longitude: 126.99 }] };
const compact = { summary: 'A culture day.', days: [{ title: 'Seoul', activities: [{ title: 'Palace visit', description: 'Explore the palace.', start: '09:00', end: '11:00', timezone: 'Asia/Seoul', placeId: 'kr-palace', location: null, minimum: 10, maximum: 20, travelMinutes: 20, reason: 'A selected cultural stop.' }] }], warnings: [] };
Deno.test('compact draft expands with exact saved coordinates and source timestamps', () => {
  const result = AiItinerarySchema.parse(expandItineraryDraft(compact, context));
  const activity = result.days[0].activities[0];
  assert(result.days[0].date === '2026-09-13', 'date comes from confirmed input');
  assert(activity.location.latitude === 37.58 && activity.location.longitude === 126.99, 'coordinates must come from the saved place');
  assert(activity.tags.includes('place:kr-palace'), 'selected stop remains identifiable');
  assert(activity.estimate.sourceTimestamp === timestamp && activity.sourceTimestamps[0] === timestamp, 'provenance copied verbatim');
  assert(activity.estimate.currency === 'MYR' && activity.accessibility.status === 'unknown', 'do not invent currency or verified access');
});
Deno.test('compact draft rejects invented place IDs and empty itineraries', () => {
  let rejected = false;
  try { expandItineraryDraft({ ...compact, days: [{ ...compact.days[0], activities: [{ ...compact.days[0].activities[0], placeId: 'invented' }] }] }, context); } catch { rejected = true; }
  assert(rejected, 'unknown place cannot acquire saved coordinates');
  assert(expandItineraryDraft({ ...compact, days: [{ title: 'Empty', activities: [] }] }, context) === null, 'empty draft must not be rendered');
});
Deno.test('compact schema requires complete days while allowing constrained travel days', () => {
  const schema = compactItineraryJsonSchema(8, false);
  const days = schema.properties!.days as { minItems: number; maxItems: number; items: { properties: { activities: { minItems?: number } } } };
  assert(days.minItems === 8 && days.maxItems === 8, 'all eight dates required');
  assert(days.items.properties.activities.minItems === 3, 'unknown transport is not an empty schedule');
});
Deno.test('provider rate limits are not reported as invalid itinerary schemas', async () => {
  Deno.env.set('GROQ_API_KEY', 'test'); Deno.env.set('GROQ_ITINERARY_MODEL', 'test-model');
  let calls = 0;
  try {
    await requestAiItinerary(context, { fetchImpl: (async () => { calls++; return new Response('{}', { status: 429 }); }) as typeof fetch });
    throw new Error('Expected rate-limit error');
  } catch (error) {
    assert(error instanceof ItineraryGenerationError && error.status === 429, 'rate limit should be distinguishable');
    assert(calls === 1, 'do not immediately repeat a throttled request');
  }
});
