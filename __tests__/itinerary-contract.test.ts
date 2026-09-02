import { ItineraryDraftSchema } from '../packages/contracts/src/itinerary';

export const validItinerary = {
  schemaVersion: '1.0' as const,
  destination: { name: 'Penang', country: 'Malaysia' },
  summary: 'A practical food and heritage day.',
  days: [{ dayNumber: 1, date: '2026-10-10', title: 'George Town', activities: [{
    activityId: 'heritage-walk', title: 'Heritage walk', description: 'A calm guided route through George Town.',
    timeBlock: { start: '09:00', end: '11:00', timezone: 'Asia/Kuala_Lumpur' },
    location: { name: 'George Town', address: 'Lebuh Armenian', latitude: 5.4141, longitude: 100.3288 },
    estimate: { currency: 'MYR', minimum: 20, maximum: 30, basis: 'per_person' as const, sourceTimestamp: '2026-09-02T10:00:00Z' },
    travelMinutes: 20,
    rationale: { explanation: 'The slower pace reflects a shared group preference.', groupSignal: 'pace' as const },
    warnings: ['Opening hours should be reconfirmed.'], confidence: { level: 'medium' as const, score: 75, reason: 'Hours can change.' },
    sourceTimestamps: ['2026-09-02T10:00:00Z'], tags: ['heritage', 'quiet'],
    accessibility: { status: 'confirmed' as const, features: ['step free'], notes: 'Step-free route available.' },
  }] }],
  warnings: ['Verify live availability before booking.'], confidence: { level: 'medium' as const, score: 75, reason: 'Live inventory is not guaranteed.' },
  sourceTimestamps: ['2026-09-02T10:00:00Z'],
};

describe('itinerary schema', () => {
  it('accepts and retains the complete fixture', () => expect(ItineraryDraftSchema.parse(validItinerary)).toEqual(validItinerary));
  it.each([
    { ...validItinerary, days: [] },
    { ...validItinerary, extraInstruction: '<script>render me</script>' },
    { ...validItinerary, days: [{ ...validItinerary.days[0], activities: [{ ...validItinerary.days[0].activities[0], timeBlock: { start: 'later', end: 'soon', timezone: 'UTC' } }] }] },
  ])('rejects malformed output and unknown fields', (value) => expect(ItineraryDraftSchema.safeParse(value).success).toBe(false));
});
