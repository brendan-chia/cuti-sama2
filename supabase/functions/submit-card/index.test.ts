import { SubmitCardPayloadSchema } from './contract.ts';
function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }
Deno.test('card submission validates identifiers and bounded content', () => {
  const base = { tripId: '67e3c78c-a1e0-41c2-9f1c-582ed656d777', roundId: '11111111-1111-4111-8111-111111111111', idempotencyKey: '9ae175da-33cc-4e25-a083-0dfc5dfb733b' };
  assert(SubmitCardPayloadSchema.safeParse({ ...base, value: 'Slow mornings' }).success, 'valid card should pass');
  assert(!SubmitCardPayloadSchema.safeParse({ ...base, value: ' ' }).success, 'blank card should fail');
  assert(!SubmitCardPayloadSchema.safeParse({ ...base, value: 'x'.repeat(241) }).success, 'oversized card should fail');
});
