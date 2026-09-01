import { LockConstraintsPayloadSchema } from './contract.ts';

function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }
Deno.test('lock payload accepts only a trip UUID', () => {
  assert(LockConstraintsPayloadSchema.safeParse({ tripId: '67e3c78c-a1e0-41c2-9f1c-582ed656d777' }).success, 'valid UUID should pass');
  assert(!LockConstraintsPayloadSchema.safeParse({ tripId: 'not-a-trip' }).success, 'invalid UUID should fail');
  assert(!LockConstraintsPayloadSchema.safeParse({ tripId: '67e3c78c-a1e0-41c2-9f1c-582ed656d777', force: true }).success, 'unknown fields should fail');
});
