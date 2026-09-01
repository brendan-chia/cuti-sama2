import { JoinTripPayloadSchema } from './contract.ts';

Deno.test('validates guest join input', () => {
  const base = { token: 'A'.repeat(43), displayName: 'Aina', confirmDuplicate: false, idempotencyKey: '9ae175da-33cc-4e25-a083-0dfc5dfb733b' };
  if (!JoinTripPayloadSchema.safeParse(base).success) throw new Error('valid join should pass');
  if (JoinTripPayloadSchema.safeParse({ ...base, displayName: '' }).success) throw new Error('empty name should fail');
});
