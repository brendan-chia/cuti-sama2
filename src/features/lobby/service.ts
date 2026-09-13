import { LobbySchema, type Lobby } from '../../../packages/contracts/src/lobby';
import { ensureAnonymousSession } from '@/lib/auth';
import { requireSupabase } from '@/lib/supabase';
import { createUuid } from '@/lib/uuid';

async function lobbyRpc(functionName: string, body: Record<string, unknown>) {
  await ensureAnonymousSession();
  const { data, error } = await requireSupabase().rpc(functionName, body);
  if (error) throw new Error(error.message);
  return LobbySchema.parse(data);
}

export function loadLobby(tripId: string) {
  return lobbyRpc('get_trip_lobby', { p_trip_id: tripId });
}

export function setLobbyReady(tripId: string, ready: boolean) {
  return lobbyRpc('set_lobby_ready', { p_trip_id: tripId, p_ready: ready, p_idempotency_key: createUuid() });
}

export function removeLobbyMember(tripId: string, memberId: string) {
  return lobbyRpc('remove_trip_member', { p_trip_id: tripId, p_member_id: memberId, p_idempotency_key: createUuid() });
}

export function startTripPlanning(tripId: string) {
  return lobbyRpc('start_trip_planning', { p_trip_id: tripId, p_idempotency_key: createUuid() });
}

type LobbySubscriptionCallbacks = {
  onChanged: () => void;
  onOnlineMembers: (memberIds: Set<string>) => void;
  onConnection: (connected: boolean) => void;
  onAccessRevoked: () => void;
};

type PresenceEntry = { memberId?: string };

// Navigation can keep multiple lobby screens mounted. Own each topic once at service level.
const subscriptions = new Map<string, { listeners: Set<LobbySubscriptionCallbacks>; connected: boolean; members: Set<string>; remove: () => Promise<unknown> }>();
let lifecycle: Promise<unknown> = Promise.resolve();
function serial<T>(work: () => Promise<T>): Promise<T> {
  const result = lifecycle.then(work);
  lifecycle = result.catch(() => undefined);
  return result;
}

export async function subscribeToLobby(lobby: Pick<Lobby, 'tripId' | 'currentMemberId'>, callbacks: LobbySubscriptionCallbacks) {
  await ensureAnonymousSession();
  const client = requireSupabase();
  const topic = `trip:${lobby.tripId}:lobby`;
  return serial(async () => {
    let entry = subscriptions.get(topic);
    if (!entry) {
      await client.realtime.setAuth();
      // Recover channels left behind by a development reload or interrupted setup.
      for (const existing of client.getChannels().filter(channel => channel.topic === `realtime:${topic}`)) await client.removeChannel(existing);
      const channel = client.channel(topic, { config: { private: true, presence: { key: lobby.currentMemberId } } });
      const shared = { listeners: new Set<LobbySubscriptionCallbacks>(), connected: false, members: new Set<string>(), remove: () => client.removeChannel(channel) };
      shared.listeners.add(callbacks);
      try {
        channel.on('broadcast', { event: 'lobby_changed' }, message => {
          const payload = message.payload as { memberId?: string; active?: boolean };
          for (const listener of shared.listeners) {
            if (payload.memberId === lobby.currentMemberId && payload.active === false) listener.onAccessRevoked();
            else listener.onChanged();
          }
        }).on('presence', { event: 'sync' }, () => {
          const entries = Object.values(channel.presenceState()).flat() as PresenceEntry[];
          shared.members = new Set(entries.flatMap(item => item.memberId ? [item.memberId] : []));
          for (const listener of shared.listeners) listener.onOnlineMembers(new Set(shared.members));
        }).subscribe(status => {
          shared.connected = status === 'SUBSCRIBED';
          for (const listener of shared.listeners) listener.onConnection(shared.connected);
          if (shared.connected) void channel.track({ memberId: lobby.currentMemberId, onlineAt: new Date().toISOString() }).catch(() => undefined);
        });
        subscriptions.set(topic, shared);
      } catch (cause) { await client.removeChannel(channel); throw cause; }
      entry = shared;
    } else {
      entry.listeners.add(callbacks);
      callbacks.onConnection(entry.connected);
      callbacks.onOnlineMembers(new Set(entry.members));
    }
    const owned = entry;
    let removed = false;
    return async () => {
      if (removed) return;
      removed = true;
      await serial(async () => {
        owned.listeners.delete(callbacks);
        if (!owned.listeners.size && subscriptions.get(topic) === owned) {
          await owned.remove();
          subscriptions.delete(topic);
        }
      });
    };
  });
}
