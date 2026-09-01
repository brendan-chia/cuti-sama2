import { ManageRoundPayloadSchema } from './contract.ts';
function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }
Deno.test('round management accepts only known actions', () => {
  const base = { tripId: '67e3c78c-a1e0-41c2-9f1c-582ed656d777', idempotencyKey: '9ae175da-33cc-4e25-a083-0dfc5dfb733b' };
  for (const action of ['start', 'close', 'advance']) assert(ManageRoundPayloadSchema.safeParse({ ...base, action }).success, `${action} should pass`);
  assert(!ManageRoundPayloadSchema.safeParse({ ...base, action: 'force_reveal' }).success, 'unknown action should fail');
});
