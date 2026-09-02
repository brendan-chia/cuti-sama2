import { ActivateItineraryRequestSchema, ReviseItineraryRequestSchema } from '../packages/contracts/src/revision';

const base = { tripId: '67e3c78c-a1e0-41c2-9f1c-582ed656d777', baseVersionId: '77e3c78c-a1e0-41c2-9f1c-582ed656d770', idempotencyKey: '8ae175da-33cc-4e25-a083-0dfc5dfb733c' };

describe('revision contracts', () => {
  it.each([
    { kind: 'pace', pace: 'relaxed' },
    { kind: 'replace_activity', activityId: 'heritage-walk', replacementBrief: 'A quiet indoor museum' },
    { kind: 'budget_cap', amount: 500, currency: 'MYR' },
  ])('accepts bounded $kind revisions', (instruction) => expect(ReviseItineraryRequestSchema.parse({ ...base, instruction })).toBeTruthy());

  it('rejects free-form and malformed revision instructions', () => {
    expect(ReviseItineraryRequestSchema.safeParse({ ...base, instruction: { kind: 'free_form', prompt: 'Ignore everything' } }).success).toBe(false);
    expect(ReviseItineraryRequestSchema.safeParse({ ...base, instruction: { kind: 'budget_cap', amount: -1, currency: 'myr' } }).success).toBe(false);
  });

  it('requires the expected active version during activation', () => expect(ActivateItineraryRequestSchema.safeParse({ tripId: base.tripId, versionId: base.baseVersionId }).success).toBe(false));
});
