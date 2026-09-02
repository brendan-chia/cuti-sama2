import { LostIdentityError, recoverAnonymousSession } from '@/lib/auth';

it('does not silently replace a lost secure-storage identity', async () => {
  const signInAnonymously = jest.fn(); const client = { auth: { getSession: jest.fn(async () => ({ data: { session: null } })), signInAnonymously } } as never;
  await expect(recoverAnonymousSession(client, { getMarker: async () => 'lost-user', saveMarker: jest.fn() })).rejects.toBeInstanceOf(LostIdentityError);
  expect(signInAnonymously).not.toHaveBeenCalled();
});
