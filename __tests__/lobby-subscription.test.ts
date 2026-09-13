import { subscribeToLobby } from '@/features/lobby/service';
import { requireSupabase } from '@/lib/supabase';
jest.mock('@/lib/auth', () => ({ ensureAnonymousSession: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ requireSupabase: jest.fn() }));
const callbacks = () => ({ onChanged: jest.fn(), onOnlineMembers: jest.fn(), onConnection: jest.fn(), onAccessRevoked: jest.fn() });
test('concurrent screens share callbacks registered before subscription and release only once', async () => {
  let subscribed = false;
  const channel: { on: jest.Mock; subscribe: jest.Mock; track?: jest.Mock; presenceState?: jest.Mock } = { on: jest.fn(() => { if (subscribed) throw new Error('callback after subscribe'); return channel; }), subscribe: jest.fn(() => { subscribed = true; return channel; }), track: jest.fn(async () => undefined), presenceState: jest.fn(() => ({})) };
  const client = { realtime: { setAuth: jest.fn(async () => undefined) }, getChannels: jest.fn(() => []), channel: jest.fn(() => channel), removeChannel: jest.fn(async () => undefined) };
  jest.mocked(requireSupabase).mockReturnValue(client as never);
  const room = { tripId: 'trip-one', currentMemberId: 'member-one' };
  const [first, second] = await Promise.all([subscribeToLobby(room, callbacks()), subscribeToLobby(room, callbacks())]);
  expect(client.channel).toHaveBeenCalledTimes(1);
  expect(channel.on).toHaveBeenCalledTimes(2);
  await first();
  expect(client.removeChannel).not.toHaveBeenCalled();
  await second(); await second();
  expect(client.removeChannel).toHaveBeenCalledTimes(1);
});
test('awaits removal of an orphaned channel before registering callbacks', async () => {
  const old = { topic: 'realtime:trip:trip-two:lobby' };
  let removed = false;
  const channel: { on: jest.Mock; subscribe: jest.Mock; track?: jest.Mock; presenceState?: jest.Mock } = { on: jest.fn(() => { expect(removed).toBe(true); return channel; }), subscribe: jest.fn(() => channel) };
  const client = { realtime: { setAuth: jest.fn(async () => undefined) }, getChannels: () => [old], channel: () => channel, removeChannel: jest.fn(async () => { removed = true; }) };
  jest.mocked(requireSupabase).mockReturnValue(client as never);
  const cleanup = await subscribeToLobby({ tripId: 'trip-two', currentMemberId: 'member-one' }, callbacks());
  expect(client.removeChannel).toHaveBeenCalledWith(old);
  await cleanup();
});
