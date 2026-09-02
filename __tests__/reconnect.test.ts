import { convergeAfterReconnect, createReconnectCoordinator } from '@/lib/reconnect';

it('detects a long disconnect and emits one reconnect transition', () => {
  let listener: ((state: { isConnected: boolean; isInternetReachable: boolean }) => void) | undefined; let now = 0;
  const coordinator = createReconnectCoordinator({ addEventListener: (next) => { listener = next; return jest.fn(); } }, () => now);
  const states: ReturnType<typeof coordinator.current>[] = []; coordinator.subscribe((state) => states.push(state));
  listener?.({ isConnected: false, isInternetReachable: false }); now = 60_001; listener?.({ isConnected: true, isInternetReachable: true });
  expect(states.at(-1)).toEqual({ online: true, offlineSince: 0, reconnectedAt: 60_001 });
});

it('converges after delayed realtime within five seconds', async () => {
  let attempts = 0; let now = 0;
  await convergeAfterReconnect(async () => { attempts += 1; if (attempts < 3) throw new Error('delayed'); }, 5_000, () => now, async (ms) => { now += ms; });
  expect(attempts).toBe(3); expect(now).toBeLessThanOrEqual(5_000);
});
