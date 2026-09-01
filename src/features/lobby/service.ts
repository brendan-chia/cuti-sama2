import * as Crypto from 'expo-crypto';

import { LobbySchema, type Lobby } from '../../../packages/contracts/src/lobby';
import { ensureAnonymousSession } from '@/lib/auth';
import { requireSupabase } from '@/lib/supabase';

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
  return lobbyRpc('set_lobby_ready', { p_trip_id: tripId, p_ready: ready, p_idempotency_key: Crypto.randomUUID() });
}

export function removeLobbyMember(tripId: string, memberId: string) {
  return lobbyRpc('remove_trip_member', { p_trip_id: tripId, p_member_id: memberId, p_idempotency_key: Crypto.randomUUID() });
}

export function startTripPlanning(tripId: string) {
  return lobbyRpc('start_trip_planning', { p_trip_id: tripId, p_idempotency_key: Crypto.randomUUID() });
}

type LobbySubscriptionCallbacks = {
  onChanged: () => void;
  onOnlineMembers: (memberIds: Set<string>) => void;
  onConnection: (connected: boolean) => void;
  onAccessRevoked: () => void;
};

type PresenceEntry = { memberId?: string };

export async function subscribeToLobby(lobby: Pick<Lobby, 'tripId' | 'currentMemberId'>, callbacks: LobbySubscriptionCallbacks) {
  await ensureAnonymousSession();
  const client = requireSupabase();
  await client.realtime.setAuth();
  const channel = client.channel(`trip:${lobby.tripId}:lobby`, { config: { private: true, presence: { key: lobby.currentMemberId } } });

  channel
    .on('broadcast', { event: 'lobby_changed' }, (message) => {
      const payload = message.payload as { memberId?: string; active?: boolean };
      if (payload.memberId === lobby.currentMemberId && payload.active === false) callbacks.onAccessRevoked();
      else callbacks.onChanged();
    })
    .on('presence', { event: 'sync' }, () => {
      const entries = Object.values(channel.presenceState()).flat() as PresenceEntry[];
      callbacks.onOnlineMembers(new Set(entries.flatMap((entry) => entry.memberId ? [entry.memberId] : [])));
    })
    .subscribe((status) => {
      const connected = status === 'SUBSCRIBED';
      callbacks.onConnection(connected);
      if (connected) void channel.track({ memberId: lobby.currentMemberId, onlineAt: new Date().toISOString() });
    });

  return async () => {
    await client.removeChannel(channel);
  };
}
