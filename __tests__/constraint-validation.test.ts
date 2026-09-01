import { buildConstraintRequest, initialConstraintForm, type ConstraintFormValues } from '@/domain/constraint-validation';

const tripId = '67e3c78c-a1e0-41c2-9f1c-582ed656d777';
const key = '9ae175da-33cc-4e25-a083-0dfc5dfb733b';
const valid: ConstraintFormValues = {
  ...initialConstraintForm,
  origin: 'Kuala Lumpur', startsOn: '2027-01-10', endsOn: '2027-01-17', dateFlexibilityDays: '0',
  budgetMin: '500', budgetMax: '1500', currency: 'MYR', maxTravelHours: '8',
  accessibilityRequirements: 'None', accessibilityVisibilityConsent: true,
};

describe('constraint validation', () => {
  it('requires every undecided-mode essential and allows optional values in other modes', () => {
    const emptyUndecided = buildConstraintRequest(tripId, 'undecided', initialConstraintForm, key);
    expect(emptyUndecided.success).toBe(false);
    if (!emptyUndecided.success) expect(Object.keys(emptyUndecided.errors)).toEqual(expect.arrayContaining(['origin', 'startsOn', 'endsOn', 'dateFlexibilityDays', 'budgetMin', 'budgetMax', 'currency', 'maxTravelHours', 'accessibilityRequirements', 'accessibilityVisibilityConsent']));
    expect(buildConstraintRequest(tripId, 'destination_locked', initialConstraintForm, key).success).toBe(true);
    expect(buildConstraintRequest(tripId, 'shortlist', { ...initialConstraintForm, climate: 'No extreme heat' }, key).success).toBe(true);
  });

  it.each(['2027-02-29', '2027-13-01', '01-10-2027'])('rejects invalid date %s', (startsOn) => {
    expect(buildConstraintRequest(tripId, 'undecided', { ...valid, startsOn }, key).success).toBe(false);
  });

  it.each([
    ['0', '100'], ['-1', '100'], ['100', '0'], ['100', '-1'], ['200', '100'],
  ])('rejects invalid budget range %s–%s', (budgetMin, budgetMax) => {
    expect(buildConstraintRequest(tripId, 'undecided', { ...valid, budgetMin, budgetMax }, key).success).toBe(false);
  });

  it.each(['RM', 'USDD', '12A', '$$$'])('rejects invalid currency %s', (currency) => {
    expect(buildConstraintRequest(tripId, 'undecided', { ...valid, currency }, key).success).toBe(false);
  });

  it('checks date, money, currency and duration boundaries across generated values', () => {
    for (let days = 0; days <= 365; days += 5) expect(buildConstraintRequest(tripId, 'undecided', { ...valid, dateFlexibilityDays: String(days) }, key).success).toBe(true);
    for (let amount = 1; amount <= 10_000; amount += 499) expect(buildConstraintRequest(tripId, 'undecided', { ...valid, budgetMin: String(amount), budgetMax: String(amount) }, key).success).toBe(true);
    for (const currency of ['MYR', 'USD', 'EUR', 'JPY', 'GBP']) expect(buildConstraintRequest(tripId, 'undecided', { ...valid, currency }, key).success).toBe(true);
    for (let hours = 1; hours <= 168; hours += 7) expect(buildConstraintRequest(tripId, 'undecided', { ...valid, maxTravelHours: String(hours) }, key).success).toBe(true);
    expect(buildConstraintRequest(tripId, 'undecided', { ...valid, dateFlexibilityDays: '366' }, key).success).toBe(false);
    expect(buildConstraintRequest(tripId, 'undecided', { ...valid, maxTravelHours: '0' }, key).success).toBe(false);
    expect(buildConstraintRequest(tripId, 'undecided', { ...valid, maxTravelHours: '169' }, key).success).toBe(false);
  });
});

