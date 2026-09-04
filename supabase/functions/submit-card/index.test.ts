import { SubmitCardPayloadSchema } from './contract.ts';
function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }
Deno.test('card submission validates structured choices and custom content', () => {
  const base = { tripId: '67e3c78c-a1e0-41c2-9f1c-582ed656d777', roundId: '11111111-1111-4111-8111-111111111111', idempotencyKey: '9ae175da-33cc-4e25-a083-0dfc5dfb733b' };
  assert(SubmitCardPayloadSchema.safeParse({ ...base, roundType: 'vibe', choiceId: 'quiet', customText: null }).success, 'predefined card should pass');
  assert(SubmitCardPayloadSchema.safeParse({ ...base, roundType: 'must_have', choiceId: 'custom', customText: 'See the cherry blossoms' }).success, 'valid custom card should pass');
  assert(!SubmitCardPayloadSchema.safeParse({ ...base, roundType: 'must_have', choiceId: 'custom', customText: ' ' }).success, 'blank custom card should fail');
  assert(!SubmitCardPayloadSchema.safeParse({ ...base, roundType: 'vibe', choiceId: 'custom', customText: 'Anything' }).success, 'custom cards stay in Must-Have');
  assert(!SubmitCardPayloadSchema.safeParse({ ...base, roundType: 'must_have', choiceId: 'custom', customText: 'x'.repeat(61) }).success, 'oversized custom card should fail');
});
