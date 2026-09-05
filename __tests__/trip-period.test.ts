import {
  asTripPeriod, buildTripPeriodCandidates, periodLength, TripPeriodRequestSchema,
  TripPeriodSuggestionsSchema, validateTripPeriodRanking,
} from '../packages/contracts/src/trip-period';

const today = '2026-09-05';
const availability = { startsOn: '2026-09-06', endsOn: '2026-11-30' };

describe('shared trip calendar', () => {
  it('suggests exact inclusive durations within the shared window, with minimal weekdays and distinct alternatives', () => {
    const candidates = buildTripPeriodCandidates(availability, 5, today);
    const suggestions = candidates.slice(0, 3);
    expect(suggestions).toHaveLength(3);
    expect(suggestions.map((period) => period.weekdayDays)).toEqual([3, 3, 3]);
    suggestions.forEach((period, index) => {
      expect(period.startsOn >= availability.startsOn).toBe(true);
      expect(period.endsOn <= availability.endsOn).toBe(true);
      expect(periodLength(period)).toBe(5);
      expect(period.weekdayDays + period.weekendDays).toBe(5);
      if (index) expect(period.startsOn > suggestions[index - 1].endsOn).toBe(true);
    });
  });

  it('does not suggest today or dates in the past', () => {
    const candidates = buildTripPeriodCandidates({ startsOn: '2026-09-01', endsOn: '2026-09-08' }, 2, today);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((period) => period.startsOn > today)).toBe(true);
    expect(buildTripPeriodCandidates({ startsOn: '2026-09-01', endsOn: today }, 2, today)).toEqual([]);
  });

  it('returns one exact option for a tight window and none when the duration cannot fit', () => {
    const narrow = { startsOn: '2026-09-10', endsOn: '2026-09-11' };
    expect(buildTripPeriodCandidates(narrow, 2, today)).toMatchObject([{ ...narrow, weekdayDays: 2, weekendDays: 0 }]);
    expect(buildTripPeriodCandidates(narrow, 3, today)).toEqual([]);
    expect(buildTripPeriodCandidates(null, 5, today)).toEqual([]);
  });

  it('handles leap days and month boundaries using calendar days', () => {
    const leapWindow = { startsOn: '2028-02-28', endsOn: '2028-03-01' };
    expect(buildTripPeriodCandidates(leapWindow, 3, today)).toMatchObject([{ ...leapWindow, durationDays: 3 }]);
    expect(periodLength({ startsOn: '2028-02-29', endsOn: '2028-03-01' })).toBe(2);
  });

  it.each([1, 15, 2.5, NaN])('rejects invalid duration %s', (duration) => {
    expect(buildTripPeriodCandidates(availability, duration, today)).toEqual([]);
  });

  it('rejects invalid or inverted dates', () => {
    expect(buildTripPeriodCandidates({ startsOn: '2027-02-30', endsOn: '2027-03-10' }, 5, today)).toEqual([]);
    expect(buildTripPeriodCandidates({ startsOn: availability.endsOn, endsOn: availability.startsOn }, 5, today)).toEqual([]);
    expect(buildTripPeriodCandidates(availability, 5, 'not-a-date')).toEqual([]);
  });

  it('keeps the pool bounded and handles the longest supported trip', () => {
    const candidates = buildTripPeriodCandidates({ startsOn: '2026-09-06', endsOn: '2029-09-05' }, 14, today);
    expect(candidates).toHaveLength(12);
    expect(candidates.every((period) => periodLength(period) === 14 && period.weekendDays === 4)).toBe(true);
  });
});

describe('trip-period response validation', () => {
  const candidates = buildTripPeriodCandidates(availability, 5, today);
  const periodIds = candidates.slice(0, 3).map((candidate) => candidate.id);

  it('allows AI to rank known IDs while preserving exact dates and factual reasons', () => {
    expect(validateTripPeriodRanking({ periodIds: [...periodIds].reverse() }, candidates))
      .toEqual(candidates.slice(0, 3).reverse().map(asTripPeriod));
  });

  it.each([
    { periodIds: [periodIds[0], periodIds[0], periodIds[1]] },
    { periodIds: [periodIds[0], periodIds[1], '2030-01-01:2030-01-05'] },
    { periodIds: periodIds.slice(0, 2) },
    { periodIds, reason: 'Guaranteed sunshine and cheap flights.' },
    { periodIds, startsOn: '2030-01-01' },
  ])('rejects fabricated, duplicate, incomplete or extra AI output', (value) => {
    expect(validateTripPeriodRanking(value, candidates)).toBeNull();
  });

  it('rejects malformed date responses from the edge service', () => {
    const base = { periods: candidates.slice(0, 3).map(asTripPeriod), source: 'calendar', message: 'Shared calendar suggestions.' };
    expect(TripPeriodSuggestionsSchema.safeParse(base).success).toBe(true);
    expect(TripPeriodSuggestionsSchema.safeParse({ ...base, periods: [base.periods[0], base.periods[0]] }).success).toBe(false);
    expect(TripPeriodSuggestionsSchema.safeParse({ ...base, periods: [{ ...base.periods[0], endsOn: '2026-02-30' }] }).success).toBe(false);
    expect(TripPeriodSuggestionsSchema.safeParse({ ...base, periods: [{ ...base.periods[0], endsOn: '2026-09-01' }] }).success).toBe(false);
  });

  it('defaults requests to five days and rejects unsupported durations and unknown inputs', () => {
    const tripId = '67e3c78c-a1e0-41c2-9f1c-582ed656d777';
    expect(TripPeriodRequestSchema.parse({ tripId }).durationDays).toBe(5);
    expect(TripPeriodRequestSchema.safeParse({ tripId, durationDays: 15 }).success).toBe(false);
    expect(TripPeriodRequestSchema.safeParse({ tripId, memberId: 'someone-else' }).success).toBe(false);
  });
});
