import { buildItinerary, haversineKm, PLANNER_DEFAULTS } from '@/domain/itinerary-planner';
import { planQuest } from '@/features/quest/planner-input';
import { countries, type Attraction } from '../packages/contracts/src/countries';
import { QuestRoomSchema } from '../packages/contracts/src/quest';

const attraction = (id: string, patch: Partial<Attraction> = {}): Attraction => ({
  id, name: id, category: 'Culture', latitude: 35, longitude: 139, description: '',
  countryId: 'JP', estimatedDurationMinutes: 90, estimatedCostMYR: 10,
  vibes: [], indoorOutdoor: 'mixed', ...patch,
});
const run = (selectedAttractions: Attraction[], days = 1, extra = {}) => buildItinerary({
  startDate: '2028-02-28', endDate: days === 1 ? '2028-02-28' : days === 2 ? '2028-02-29' : '2028-03-01',
  selectedAttractions, ...extra,
});
const ids = (plan: ReturnType<typeof run>) => plan.days.flatMap(day => day.stops.map(stop => stop.attractionId));

it('schedules a one-day visit at nine with activity-only cost', () => {
  const plan = run([attraction('a')]);
  expect(plan.days).toHaveLength(1);
  expect(plan.days[0].stops[0]).toMatchObject({ attractionId: 'a', estimatedStartTime: '09:00', estimatedEndTime: '10:30', estimatedVisitMinutes: 90, estimatedTravelMinutesFromPrevious: 0 });
  expect(plan.estimatedActivityTotalMYR).toBe(10);
  expect(plan.days[0].estimatedScheduledMinutes).toBe(150);
});
it('covers inclusive dates across a leap day and distributes excess visits', () => {
  const plan = run(Array.from({ length: 7 }, (_, i) => attraction(String(i))), 3);
  expect(plan.days.map(day => day.date)).toEqual(['2028-02-28', '2028-02-29', '2028-03-01']);
  expect(ids(plan)).toHaveLength(7);
  expect(plan.days.every(day => day.estimatedScheduledMinutes <= 480)).toBe(true);
});
it('starts in the dense neighbourhood and orders nearby stops together', () => {
  const plan = run([attraction('remote', { longitude: 139.6 }), attraction('b', { longitude: 139.01 }), attraction('a'), attraction('c', { longitude: 139.02 })], 2);
  expect(plan.days[0].stops.map(stop => stop.attractionId).sort()).toEqual(['a', 'b', 'c']);
});
it('leaves very distant places out rather than teleporting between days', () => {
  const plan = run([attraction('a'), attraction('z', { latitude: -33, longitude: 151 })], 3);
  expect(ids(plan)).toEqual(['a']);
  expect(plan.unscheduledAttractionIds).toEqual(['z']);
  expect(plan.unscheduledReasons.z).toContain('separate travel plan');
});
it('charges the next day for transfer from the preceding day', () => {
  const plan = buildItinerary({ startDate: '2028-01-01', endDate: '2028-01-02',
    selectedAttractions: [attraction('a'), attraction('b', { longitude: 139.1 })] }, { maxStopsPerDay: 1 });
  expect(plan.days[1].stops[0].estimatedTravelMinutesFromPrevious).toBeGreaterThan(0);
  expect(plan.days[1].stops[0].estimatedStartTime).not.toBe('09:00');
});
it('returns excess selections and their names remain addressable by ID', () => {
  const plan = run(Array.from({ length: 12 }, (_, i) => attraction(String(i))));
  expect(ids(plan).length).toBeLessThanOrEqual(4);
  expect(ids(plan).length + plan.unscheduledAttractionIds.length).toBe(12);
  expect(plan.warnings.join(' ')).toContain('1-day itinerary');
});
it('does not force four three-hour attractions into a day', () => {
  const plan = run(['a', 'b', 'c', 'd'].map(id => attraction(id, { estimatedDurationMinutes: 180 })));
  expect(ids(plan)).toHaveLength(2);
  expect(plan.days[0].estimatedScheduledMinutes).toBeLessThanOrEqual(480);
});
it('rejects a visit longer than a day and reserves lunch for a full-day park', () => {
  expect(run([attraction('long', { estimatedDurationMinutes: 600 })]).unscheduledAttractionIds).toEqual(['long']);
  const plan = run([attraction('park', { estimatedDurationMinutes: 420 })]);
  expect(plan.days[0].stops[0]).toMatchObject({ estimatedEndTime: '17:00', includedMealBreakMinutes: 60 });
  expect(plan.days[0].estimatedScheduledMinutes).toBe(480);
});
it('is deterministic even when selections arrive in a different order', () => {
  const places = ['c', 'a', 'b'].map(id => attraction(id));
  expect(run(places)).toEqual(run([...places].reverse()));
  expect(run(places)).toEqual(run(places));
});
it('never mutates frozen inputs or nested vibe arrays', () => {
  const place = Object.freeze({ ...attraction('a'), vibes: Object.freeze(['quiet']) });
  const input = Object.freeze({ startDate: '2028-01-01', endDate: '2028-01-02', selectedAttractions: Object.freeze([place]), groupVibes: Object.freeze(['quiet']) });
  const before = JSON.stringify(input);
  expect(() => buildItinerary(input as unknown as Parameters<typeof buildItinerary>[0])).not.toThrow();
  expect(JSON.stringify(input)).toBe(before);
});
it('sums only scheduled costs without floating-point drift and warns on budget', () => {
  const plan = run([attraction('a', { estimatedCostMYR: 0.1 }), attraction('b', { estimatedCostMYR: 0.2 }), attraction('z', { estimatedCostMYR: 100, estimatedDurationMinutes: 1000 })], 1, { groupBudgetCeilingMYR: 0.2 });
  expect(plan.estimatedActivityTotalMYR).toBe(0.3);
  expect(plan.days[0].estimatedActivityCostMYR).toBe(0.3);
  expect(plan.warnings.join(' ')).toContain('RM0.10');
  expect(plan.costBasis).toBe('per_person');
});
it('uses vibes as a soft tie-break without violating hard limits', () => {
  const places = [attraction('a'), attraction('b', { vibes: ['adventurous'] }), attraction('long', { vibes: ['adventurous'], estimatedDurationMinutes: 900 })];
  const plan = run(places, 1, { groupVibes: ['adventurous'] });
  expect(ids(plan)[0]).toBe('b');
  expect(plan.unscheduledAttractionIds).toContain('long');
  expect(plan.days[0].estimatedScheduledMinutes).toBeLessThanOrEqual(480);
});
it('vibes never pull the route to a distant isolated attraction', () => {
  const places = [attraction('a'), attraction('b', { longitude: 139.001 }), attraction('c', { longitude: 139.002 }), attraction('z', { longitude: 141, vibes: ['adventurous'] })];
  const plan = run(places, 2, { groupVibes: Array(8).fill('adventurous') });
  expect(ids(plan)).not.toContain('z');
});
it.each(['2028-02-30', 'invalid', '2028-13-01'])('rejects invalid dates: %s', date => {
  expect(() => buildItinerary({ startDate: date, endDate: date, selectedAttractions: [] })).toThrow();
});
it('rejects reversed and excessive ranges, duplicate IDs and invalid budgets/config', () => {
  expect(() => buildItinerary({ startDate: '2028-02-02', endDate: '2028-02-01', selectedAttractions: [] })).toThrow();
  expect(() => buildItinerary({ startDate: '2028-01-01', endDate: '2028-12-31', selectedAttractions: [] })).toThrow();
  expect(() => run([attraction('a'), attraction('a')])).toThrow();
  expect(() => run([], 1, { groupBudgetCeilingMYR: NaN })).toThrow();
  expect(() => buildItinerary({ startDate: '2028-01-01', endDate: '2028-01-01', selectedAttractions: [] }, { approximateSpeedKmh: 0 })).toThrow();
});
it('handles missing metadata, invalid coordinates and special access as named omissions', () => {
  const plan = run([attraction('missing', { estimatedCostMYR: undefined }), attraction('bad', { latitude: NaN }), attraction('boat', { requiresSpecialPlanning: true })]);
  expect(ids(plan)).toEqual([]);
  expect(plan.unscheduledAttractionIds).toEqual(['bad', 'boat', 'missing']);
});
it('handles no selections and keeps Haversine stable across the antimeridian', () => {
  expect(run([]).days[0].stops).toEqual([]);
  expect(haversineKm({ latitude: 0, longitude: 179.9 }, { latitude: 0, longitude: -179.9 })).toBeCloseTo(22.239, 2);
  expect(haversineKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 })).toBe(0);
});
it('provides consistent planning metadata for all 120 bundled attractions', () => {
  const places = countries.flatMap(country => country.attractions);
  expect(places).toHaveLength(120);
  expect(new Set(places.map(place => place.id)).size).toBe(120);
  for (const country of countries) for (const place of country.attractions) {
    expect(place.countryId).toBe(country.code);
    expect(place.estimatedDurationMinutes).toBeGreaterThan(0);
    expect(place.estimatedCostMYR).toBeGreaterThanOrEqual(0);
    expect(place.estimateBasis).toBe('category_allowance_v1');
    expect(place.vibes?.length).toBeGreaterThan(0);
    expect(['indoor', 'outdoor', 'mixed']).toContain(place.indoorOutdoor);
    expect(place.description).toBeTruthy();
    expect(place.sourceUrl).toBeTruthy();
  }
});
it('keeps daily caps, non-overlap and complete ID accounting for the entire catalog', () => {
  for (const country of countries) {
    const plan = run(country.attractions, 3);
    const allIds = [...ids(plan), ...plan.unscheduledAttractionIds];
    expect(allIds.sort()).toEqual(country.attractions.map(place => place.id).sort());
    expect(new Set(allIds).size).toBe(allIds.length);
    for (const day of plan.days) {
      expect(day.estimatedScheduledMinutes).toBeLessThanOrEqual(PLANNER_DEFAULTS.maxScheduledMinutesPerDay);
      expect(day.stops.length).toBeLessThanOrEqual(PLANNER_DEFAULTS.maxStopsPerDay);
      for (let i = 1; i < day.stops.length; i++) expect(day.stops[i].estimatedStartTime >= day.stops[i - 1].estimatedEndTime).toBe(true);
    }
  }
});
it('quest adapter uses only saved selections, retains unknown IDs and aggregate vibes', () => {
  const room = QuestRoomSchema.parse({
    tripId: '11111111-1111-4111-8111-111111111111', tripName: 'Test trip',
    currentMemberId: '11111111-1111-4111-8111-111111111111', currentRole: 'organizer',
    stage: 'logistics', revision: 1, members: [{ memberId: '11111111-1111-4111-8111-111111111111', displayName: 'Host', availabilitySubmitted: true, picksSubmitted: true, votesSubmitted: true, budgetSubmitted: true }],
    ownAvailability: null, sharedAvailability: null, period: { startsOn: '2028-01-01', endsOn: '2028-01-01', label: 'Trip', reason: 'Locked' },
    ownPicks: [], countries: ['JP'], ownVotes: {}, results: [], tiedCountryCodes: [],
    selectedCountryCode: 'JP', attractionIds: ['jp-sensoji', 'unknown'], ownBudget: null,
    budgetSummary: null, groupVibes: ['quiet'],
  });
  const plan = planQuest(room);
  expect(ids(plan)).toEqual(['jp-sensoji']);
  expect(plan.unscheduledAttractionIds).toEqual(['unknown']);
});
