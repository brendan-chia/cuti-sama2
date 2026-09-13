import { FunctionsHttpError } from '@supabase/supabase-js';
import { withSessionRefresh } from '@/lib/session-request';
import { requireSupabase } from '@/lib/supabase';

jest.mock('@/lib/auth', () => ({ ensureAnonymousSession: jest.fn(), LostIdentityError: class extends Error {} }));
jest.mock('@/lib/supabase', () => ({ requireSupabase: jest.fn() }));
const refreshSession = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  (requireSupabase as jest.Mock).mockReturnValue({ auth: { refreshSession } });
  refreshSession.mockResolvedValue({ data: { session: { user: { id: 'same-user' } } }, error: null });
});
test.each([
  { code: 'PGRST301', message: 'JWT expired' },
  { code: 'PGRST303', message: 'JWT expired' },
  { message: 'Token has expired' },
  new FunctionsHttpError({ status: 401, clone: () => ({ json: async () => ({ message: 'JWT expired' }) }) }),
])('refreshes and retries an expired token once', async error => {
  const request = jest.fn().mockResolvedValueOnce({ error }).mockResolvedValueOnce({ error: null, data: 'saved' });
  await expect(withSessionRefresh(request)).resolves.toEqual({ error: null, data: 'saved' });
  expect(refreshSession).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledTimes(2);
});
test('does not loop if the retry is rejected', async () => {
  const result = { error: { code: 'PGRST301', message: 'JWT expired' } };
  const request = jest.fn().mockResolvedValue(result);
  await expect(withSessionRefresh(request)).rejects.toThrow('Your session could not be renewed');
  expect(request).toHaveBeenCalledTimes(2);
});
test('does not retry unrelated errors', async () => {
  const result = { error: { message: 'Network error' } };
  await expect(withSessionRefresh(jest.fn().mockResolvedValue(result))).resolves.toBe(result);
  expect(refreshSession).not.toHaveBeenCalled();
});
test('stops when session refresh fails', async () => {
  refreshSession.mockResolvedValue({ data: { session: null }, error: { message: 'Offline' } });
  const request = jest.fn().mockResolvedValue({ error: { code: 'PGRST301', message: 'JWT expired' } });
  await expect(withSessionRefresh(request)).rejects.toThrow('Could not renew your session');
  expect(request).toHaveBeenCalledTimes(1);
});

test('shares a single refresh across simultaneous expired requests', async () => {
  let finish!: (value: unknown) => void;
  refreshSession.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const first = jest.fn().mockResolvedValueOnce({ error: { code: 'PGRST303', message: 'JWT expired' } }).mockResolvedValueOnce({ error: null });
  const second = jest.fn().mockResolvedValueOnce({ error: { code: 'PGRST303', message: 'JWT expired' } }).mockResolvedValueOnce({ error: null });
  const pending = Promise.all([withSessionRefresh(first), withSessionRefresh(second)]);
  for (let i = 0; i < 10; i++) await Promise.resolve();
  expect(refreshSession).toHaveBeenCalledTimes(1);
  finish({ data: { session: { user: { id: 'same-user' } } }, error: null });
  await expect(pending).resolves.toEqual([{ error: null }, { error: null }]);
});
