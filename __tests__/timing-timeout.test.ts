import { suggestTripPeriods } from '@/features/quest/timing';
import { ensureAnonymousSession } from '@/lib/auth';
import { requireSupabase } from '@/lib/supabase';
jest.mock('@/lib/auth', () => ({ ensureAnonymousSession: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ requireSupabase: jest.fn() }));
beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); });
afterEach(() => jest.useRealTimers());
test('times out even when authentication never resolves', async () => {
  jest.mocked(ensureAnonymousSession).mockReturnValue(new Promise(() => undefined));
  const request = suggestTripPeriods('67e3c78c-a1e0-41c2-9f1c-582ed656d777');
  const assertion = expect(request).rejects.toThrow('Finding dates took too long');
  await jest.advanceTimersByTimeAsync(30000);
  await assertion;
  expect(requireSupabase).not.toHaveBeenCalled();
});
test('aborts a stalled edge request so the user can retry', async () => {
  jest.mocked(ensureAnonymousSession).mockResolvedValue({} as never);
  const invoke = jest.fn(() => new Promise(() => undefined));
  jest.mocked(requireSupabase).mockReturnValue({ functions: { invoke } } as never);
  const assertion = expect(suggestTripPeriods('67e3c78c-a1e0-41c2-9f1c-582ed656d777')).rejects.toThrow('Finding dates took too long');
  await jest.advanceTimersByTimeAsync(30000);
  await assertion;
  expect((invoke.mock.calls[0] as unknown as [string, { signal: AbortSignal }])[1].signal.aborted).toBe(true);
});
