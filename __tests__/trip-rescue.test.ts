import { rescueDay } from '@/features/trip-mode/rescue';
import { TripModeDataSchema, type TripModeData } from '../packages/contracts/src/trip-mode';
import type { Attraction } from '../packages/contracts/src/countries';
const place = (id: string, extra: Partial<Attraction> = {}): Attraction => ({ id, name: id, category: 'Culture', description: '', countryId: 'JP', latitude: 35, longitude: 139, estimatedDurationMinutes: 60, estimatedCostMYR: 50, indoorOutdoor: 'indoor', vibes: ['quiet'], ...extra });
const places = [place('completed'), place('park', { indoorOutdoor: 'outdoor' }), place('museum'), place('other-day')];
const stop = (id: string, start: string, end: string) => ({ attractionId: id, estimatedStartTime: start, estimatedEndTime: end, estimatedVisitMinutes: 120, estimatedTravelMinutesFromPrevious: 10, includedMealBreakMinutes: 0 });
const day = (date: string, stops: ReturnType<typeof stop>[]) => ({ date, stops, estimatedActivityCostMYR: stops.length * 50, estimatedScheduledMinutes: 240, reservedMealBreakMinutes: 60 });
const input = (): TripModeData => ({ days: [day('2027-01-01', [stop('completed', '09:00', '10:00'), stop('park', '13:00', '16:00')]), day('2027-01-02', [stop('other-day', '09:00', '11:00')])], completedIds: ['completed'] });
test('rain uses unscheduled indoor places, preserving completed stops and source data', () => {
  const data = input(), before = JSON.stringify(data);
  const result = rescueDay({ data, date: '2027-01-01', places, reason: 'weather', vibes: ['quiet'], activityBudget: 200 });
  expect(result?.removed).toEqual(['park']); expect(result?.added).toEqual(['museum']);
  expect(result?.day.stops[0]).toEqual(data.days[0].stops[0]);
  expect(result?.reasons.join(' ')).toContain('quiet'); expect(JSON.stringify(data)).toBe(before);
  expect(() => TripModeDataSchema.parse({ ...data, days: [result!.day, data.days[1]] })).not.toThrow();
});
test('rejects alternatives that violate budget, location, indoor, duration or metadata requirements', () => {
  for (const extra of [{ estimatedCostMYR: 1000 }, { latitude: 40 }, { indoorOutdoor: 'outdoor' as const }, { estimatedDurationMinutes: undefined }, { estimatedCostMYR: undefined }, { estimatedDurationMinutes: 400 }, { requiresSpecialPlanning: true }]) {
    expect(rescueDay({ data: input(), date: '2027-01-01', places: places.map(p => p.id === 'museum' ? { ...p, ...extra } : p), reason: 'weather', activityBudget: 150 })).toBeNull();
  }
});
test('unavailable replaces only the selected unfinished stop', () => {
  expect(rescueDay({ data: input(), date: '2027-01-01', places, reason: 'unavailable', targetId: 'completed' })).toBeNull();
  expect(rescueDay({ data: input(), date: '2027-01-01', places, reason: 'unavailable', targetId: 'park' })?.added).toEqual(['museum']);
});
test('late shifts unfinished stops and refuses midnight overflow', () => {
  const data = input(); const result = rescueDay({ data, date: '2027-01-01', places, reason: 'late', delay: 30 });
  expect(result?.day.stops[1].estimatedStartTime).toBe('13:30'); expect(result?.day.stops[0]).toEqual(data.days[0].stops[0]); expect(result?.budgetDelta).toBe(0);
  data.days[0].stops[1] = stop('park', '23:00', '23:50');
  expect(rescueDay({ data, date: '2027-01-01', places, reason: 'late', delay: 30 })).toBeNull();
});
test('unknown budget and preferences are never claimed as matches', () => {
  const data = input(); const result = rescueDay({ data, date: '2027-01-01', places, reason: 'weather' });
  expect(result?.reasons).toContain('Full budget fit is unconfirmed.'); expect(result?.reasons.join(' ')).not.toContain('Matches shared');
  data.completedIds.push('park'); expect(rescueDay({ data, date: '2027-01-01', places, reason: 'weather' })).toBeNull();
});
test('state validation rejects unknown completion and overlaps', () => {
  const data = input(); expect(() => TripModeDataSchema.parse({ ...data, completedIds: ['missing'] })).toThrow();
  data.days[0].stops[1].estimatedStartTime = '09:30'; expect(() => TripModeDataSchema.parse(data)).toThrow();
});
