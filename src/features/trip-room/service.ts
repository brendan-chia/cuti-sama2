import { ManageRoundPayloadSchema, SubmitCardPayloadSchema, TripRoomSchema, type ManageRoundPayload, type SubmitCardPayload, type TripRoom } from '../../../packages/contracts/src/preferences';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { ensureAnonymousSession } from '@/lib/auth';
import { withPersistentOperationKey } from '@/lib/idempotency';
import { requireSupabase } from '@/lib/supabase';

export async function loadTripRoom(tripId: string) {
  await ensureAnonymousSession();
  const { data, error } = await requireSupabase().rpc('get_preference_room', { p_trip_id: tripId });
  if (error) throw new Error(error.message);
  return TripRoomSchema.parse(data);
}
async function invokeRoomFunction(name: string, payload: SubmitCardPayload | ManageRoundPayload) {
  await ensureAnonymousSession();
  const { data, error } = await requireSupabase().functions.invoke(name, { body: payload });
  if (error) {
    let message = error.message;
    if (error instanceof FunctionsHttpError) {
      try { const body = await error.context.json() as { error?: unknown }; if (typeof body.error === 'string') message = body.error; } catch { /* Keep the SDK message when the body is unreadable. */ }
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return TripRoomSchema.parse(data);
}
export function submitPreferenceCard(input: Omit<SubmitCardPayload, 'idempotencyKey'>) {
  return withPersistentOperationKey('submit-card', `${input.tripId}.${input.roundId}`, { choiceId: input.choiceId, customText: input.customText }, (idempotencyKey) => invokeRoomFunction('submit-card', SubmitCardPayloadSchema.parse({ ...input, idempotencyKey })));
}
export function managePreferenceRound(tripId: string, action: ManageRoundPayload['action']) {
  return withPersistentOperationKey('manage-round', tripId, { action }, (idempotencyKey) => invokeRoomFunction('manage-round', ManageRoundPayloadSchema.parse({ tripId, action, idempotencyKey })));
}
type Callbacks = { onChanged: () => void; onConnection: (connected: boolean) => void };
export async function subscribeToTripRoom(room: Pick<TripRoom, 'tripId'>, callbacks: Callbacks) {
  await ensureAnonymousSession();
  const client = requireSupabase();
  await client.realtime.setAuth();
  const channel = client.channel(`trip:${room.tripId}:lobby`, { config: { private: true } });
  channel.on('broadcast', { event: 'lobby_changed' }, callbacks.onChanged).subscribe((status) => callbacks.onConnection(status === 'SUBSCRIBED'));
  return async () => { await client.removeChannel(channel); };
}
