import { buildCreateTripRequest, initialCreateTripForm } from '@/features/trips/validation';

const key = '9ae175da-33cc-4e25-a083-0dfc5dfb733b';

describe('create trip validation', () => {
  it('normalizes a locked destination request', () => {
    const result = buildCreateTripRequest({
      ...initialCreateTripForm,
      tripName: '  Langkawi long weekend  ',
      lockedDestination: '  Langkawi, Malaysia  ',
      startsOn: '2026-12-05',
      endsOn: '2026-12-08',
    }, key);

    expect(result).toEqual({ success: true, data: {
      tripName: 'Langkawi long weekend', mode: 'destination_locked',
      destinations: ['Langkawi, Malaysia'], startsOn: '2026-12-05',
      endsOn: '2026-12-08', idempotencyKey: key,
    }});
  });

  it('accepts two to five unique shortlist destinations', () => {
    const result = buildCreateTripRequest({
      ...initialCreateTripForm, tripName: 'Friends escape', mode: 'shortlist',
      shortlist: 'Bangkok, Thailand\nDa Nang, Vietnam\nSeoul, South Korea',
    }, key);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.destinations).toHaveLength(3);
  });

  it('rejects duplicate and undersized shortlists', () => {
    const duplicate = buildCreateTripRequest({
      ...initialCreateTripForm, tripName: 'Friends escape', mode: 'shortlist', shortlist: 'Bangkok\nbangkok',
    }, key);
    expect(duplicate.success).toBe(false);
    if (!duplicate.success) expect(duplicate.errors.shortlist).toMatch(/unique/i);

    const undersized = buildCreateTripRequest({
      ...initialCreateTripForm, tripName: 'Friends escape', mode: 'shortlist', shortlist: 'Bangkok',
    }, key);
    expect(undersized.success).toBe(false);
  });

  it('allows undecided mode without a destination', () => {
    const result = buildCreateTripRequest({
      ...initialCreateTripForm, tripName: 'Somewhere together', mode: 'undecided',
    }, key);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.destinations).toEqual([]);
  });

  it('rejects impossible and inverted date ranges', () => {
    const impossible = buildCreateTripRequest({
      ...initialCreateTripForm, tripName: 'Beach break', lockedDestination: 'Tioman', startsOn: '2026-02-30',
    }, key);
    expect(impossible.success).toBe(false);
    if (!impossible.success) expect(impossible.errors.startsOn).toMatch(/calendar date/i);

    const inverted = buildCreateTripRequest({
      ...initialCreateTripForm, tripName: 'Beach break', lockedDestination: 'Tioman', startsOn: '2026-12-10', endsOn: '2026-12-05',
    }, key);
    expect(inverted.success).toBe(false);
    if (!inverted.success) expect(inverted.errors.endsOn).toMatch(/before/i);
  });
});
