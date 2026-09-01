import { ManageInvitePayloadSchema } from './contract.ts';

function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }
const tripId = '67e3c78c-a1e0-41c2-9f1c-582ed656d777';
const idempotencyKey = '9ae175da-33cc-4e25-a083-0dfc5dfb733b';

Deno.test('requires a client-generated opaque token for issue and rotate', () => {
  assert(ManageInvitePayloadSchema.safeParse({ action: 'issue', tripId, token: 'A'.repeat(43), idempotencyKey }).success, 'valid issuance should pass');
  assert(!ManageInvitePayloadSchema.safeParse({ action: 'rotate', tripId, token: 'short', idempotencyKey }).success, 'short token should fail');
});

Deno.test('status cannot include a raw token', () => {
  assert(!ManageInvitePayloadSchema.safeParse({ action: 'status', tripId, token: 'A'.repeat(43) }).success, 'status shape should be strict');
});
