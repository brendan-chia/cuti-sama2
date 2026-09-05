import { buildCombinedCandidates, validateCombinedRanking, type DateInput } from '../packages/contracts/src/combined-dates';
const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';
const input = (memberId = a, startsOn = '2026-09-14', endsOn = '2026-09-18'): DateInput => ({ memberId, startsOn, endsOn, preferences: { flexibility: '7', daysOff: [0, 6], unavailable: [] } });
const holiday = { date: '2026-09-16', name: 'Malaysia Day' };
const today = '2026-09-05';
it('combines non-overlapping preferred periods without copying either proposal', () => {
  const inputs = [input(), input(b, '2026-09-20', '2026-09-24')];
  const candidates = buildCombinedCandidates(inputs, [holiday], today);
  expect(candidates.length).toBeGreaterThan(0);
  expect(candidates.some((c) => inputs.every((i) => c.startsOn !== i.startsOn))).toBe(true);
  expect(candidates.every((c) => c.durationDays === 5 && c.travellers.every((t) => Math.abs(t.shiftDays) <= 7))).toBe(true);
});
it('excludes every date in hard ranges including start and end boundaries', () => {
  const i = input(); i.preferences.unavailable = [{ startsOn: '2026-09-15', endsOn: '2026-09-20' }];
  const candidates = buildCombinedCandidates([i], [holiday], today);
  expect(candidates.length).toBeGreaterThan(0);
  expect(candidates.every((c) => c.endsOn < '2026-09-15' || c.startsOn > '2026-09-20')).toBe(true);
});
it('counts different work schedules and holidays without double counting', () => {
  const first = input(); first.preferences.flexibility = 'exact';
  const second = input(b); second.preferences.daysOff = [5, 6];
  const [c] = buildCombinedCandidates([first, second], [holiday, holiday], today);
  expect(c.travellers.map((t) => t.leaveDays)).toEqual([4, 3]);
});
it('returns no answer for conflicting exact dates or blackout covering all options', () => {
  const first = input(); first.preferences.flexibility = 'exact';
  const second = input(b, '2026-09-20', '2026-09-24'); second.preferences.flexibility = 'exact';
  expect(buildCombinedCandidates([first, second], [], today)).toEqual([]);
  first.preferences.unavailable = [{ startsOn: first.startsOn, endsOn: first.endsOn }];
  expect(buildCombinedCandidates([first], [], today)).toEqual([]);
});
it('preserves submitted durations, exposes changes, and never silently truncates', () => {
  const candidates = buildCombinedCandidates([input(), input(b, '2026-09-14', '2026-09-20')], [], today);
  expect(candidates.every((c) => [5, 7].includes(c.durationDays))).toBe(true);
  expect(candidates.every((c) => c.travellers.some((t) => t.durationChange !== 0))).toBe(true);
});
it('handles month boundaries, leap years and future dates', () => {
  const i = input(a, '2028-02-28', '2028-03-01'); i.preferences.flexibility = 'exact';
  expect(buildCombinedCandidates([i], [], today)[0].durationDays).toBe(3);
  i.preferences.flexibility = 'month';
  expect(buildCombinedCandidates([i], [], today).every((c) => c.startsOn.startsWith('2028-02'))).toBe(true);
  expect(buildCombinedCandidates([input()], [], '2026-10-01')).toEqual([]);
});
it('accepts only supplied unique IDs and rejects worse primary recommendations', () => {
  const candidates = buildCombinedCandidates([input()], [holiday], today);
  const periodIds = candidates.slice(0, 3).map((c) => c.id);
  expect(validateCombinedRanking({ periodIds }, candidates)).toEqual(candidates.slice(0, 3));
  expect(validateCombinedRanking({ periodIds: ['invented', ...periodIds.slice(1)] }, candidates)).toBeNull();
  expect(validateCombinedRanking({ periodIds: [periodIds[0], periodIds[0], periodIds[2]] }, candidates)).toBeNull();
  const worse = candidates.find((c) => c.maxLeave > candidates[0].maxLeave)!;
  expect(validateCombinedRanking({ periodIds: [worse.id, periodIds[0], periodIds[1]] }, candidates)).toBeNull();
});
