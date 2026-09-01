import * as Crypto from 'expo-crypto';

import { CloseVotePayloadSchema, LockDestinationPayloadSchema, SubmitVotePayloadSchema, VoteRoomSchema, type CloseVotePayload, type VoteRoom } from '../../../packages/contracts/src/vote';
import { ensureAnonymousSession } from '@/lib/auth';
import { requireSupabase } from '@/lib/supabase';

export async function loadVoteRoom(tripId: string) {
  await ensureAnonymousSession();
  const { data, error } = await requireSupabase().rpc('get_destination_vote_room', { p_trip_id: tripId });
  if (error) throw new Error(error.message);
  return VoteRoomSchema.parse(data);
}

async function invoke(name: string, body: Record<string, unknown>) {
  await ensureAnonymousSession();
  const { data, error } = await requireSupabase().functions.invoke(name, { body });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return VoteRoomSchema.parse(data);
}

export function submitVote(tripId: string, roundId: string, optionId: string) {
  return invoke('submit-vote', SubmitVotePayloadSchema.parse({ tripId, roundId, optionId, idempotencyKey: Crypto.randomUUID() }));
}

export function manageVote(tripId: string, action: CloseVotePayload['action']) {
  return invoke('close-vote', CloseVotePayloadSchema.parse({ tripId, action, idempotencyKey: Crypto.randomUUID() }));
}

export function setDestinationLock(tripId: string, optionId: string, action: 'lock' | 'unlock') {
  return invoke('lock-destination', LockDestinationPayloadSchema.parse({ tripId, optionId, action, idempotencyKey: Crypto.randomUUID() }));
}

type Callbacks = { onChanged: () => void; onConnection: (connected: boolean) => void };
export async function subscribeToVotes(room: Pick<VoteRoom, 'tripId'>, callbacks: Callbacks) {
  await ensureAnonymousSession();
  const client = requireSupabase(); await client.realtime.setAuth();
  const channel = client.channel(`trip:${room.tripId}:vote`, { config: { private: true } });
  channel.on('broadcast', { event: 'vote_changed' }, callbacks.onChanged).subscribe((status) => callbacks.onConnection(status === 'SUBSCRIBED'));
  return async () => { await client.removeChannel(channel); };
}
