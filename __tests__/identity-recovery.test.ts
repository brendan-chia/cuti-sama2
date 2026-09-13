import { LostIdentityError, recoverAnonymousSession } from '@/lib/auth';

it('renews an expiring session while preserving the guest identity', async () => {
  const session = { user: { id: 'existing-user' }, expires_at: Date.now() / 1000 - 1 };
  const renewed = { ...session, expires_at: Date.now() / 1000 + 3600 };
  const auth = {
    getSession: jest.fn().mockResolvedValue({ data: { session }, error: null }),
    refreshSession: jest.fn().mockResolvedValue({ data: { session: renewed }, error: null }),
    signInAnonymously: jest.fn(),
  };
  const saveMarker = jest.fn().mockResolvedValue(undefined);
  await expect(recoverAnonymousSession({ auth } as never, { getMarker: async () => 'existing-user', saveMarker })).resolves.toBe(renewed);
  expect(auth.refreshSession).toHaveBeenCalledTimes(1);
  expect(auth.signInAnonymously).not.toHaveBeenCalled();
  expect(saveMarker).toHaveBeenCalledWith('existing-user');
});

it('does not create a new identity when reading the session fails', async () => {
  const auth = { getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: { message: 'Offline' } }), signInAnonymously: jest.fn() };
  await expect(recoverAnonymousSession({ auth } as never, { getMarker: async () => null, saveMarker: jest.fn() })).rejects.toThrow('Could not restore your session');
  expect(auth.signInAnonymously).not.toHaveBeenCalled();
});

it('does not silently replace a lost secure-storage identity', async () => {
  const signInAnonymously = jest.fn(); const client = { auth: { getSession: jest.fn(async () => ({ data: { session: null } })), signInAnonymously } } as never;
  await expect(recoverAnonymousSession(client, { getMarker: async () => 'lost-user', saveMarker: jest.fn() })).rejects.toBeInstanceOf(LostIdentityError);
  expect(signInAnonymously).not.toHaveBeenCalled();
});
