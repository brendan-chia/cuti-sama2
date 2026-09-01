import {
  ConstraintCollectionSchema,
  type ConstraintCollection,
  type ConstraintRequest,
} from '../../../packages/contracts/src/constraints';
import { ensureAnonymousSession } from '@/lib/auth';
import { requireSupabase } from '@/lib/supabase';

async function collectionRpc(functionName: string, body: Record<string, unknown>) {
  await ensureAnonymousSession();
  const { data, error } = await requireSupabase().rpc(functionName, body);
  if (error) throw new Error(error.message);
  return ConstraintCollectionSchema.parse(data);
}

export function loadConstraintCollection(tripId: string) {
  return collectionRpc('get_constraint_collection', { p_trip_id: tripId });
}

export function saveConstraints(request: ConstraintRequest) {
  return collectionRpc('save_member_constraints', {
    p_trip_id: request.tripId,
    p_origin: request.origin,
    p_starts_on: request.startsOn,
    p_ends_on: request.endsOn,
    p_date_flexibility_days: request.dateFlexibilityDays,
    p_budget_min: request.budgetMin,
    p_budget_max: request.budgetMax,
    p_currency: request.currency,
    p_max_travel_minutes: request.maxTravelMinutes,
    p_accessibility_requirements: request.accessibilityRequirements,
    p_accessibility_visibility_consent: request.accessibilityVisibilityConsent,
    p_climate: request.climate,
    p_visa_concern: request.visaConcern,
    p_transport: request.transport,
    p_accommodation: request.accommodation,
    p_idempotency_key: request.idempotencyKey,
  });
}

export async function lockConstraints(tripId: string) {
  await ensureAnonymousSession();
  const { data, error } = await requireSupabase().functions.invoke('lock-constraints', { body: { tripId } });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return ConstraintCollectionSchema.parse(data);
}

type Callbacks = { onChanged: () => void; onConnection: (connected: boolean) => void };

export async function subscribeToConstraints(collection: Pick<ConstraintCollection, 'tripId'>, callbacks: Callbacks) {
  await ensureAnonymousSession();
  const client = requireSupabase();
  await client.realtime.setAuth();
  const channel = client.channel(`trip:${collection.tripId}:lobby`, { config: { private: true } });
  channel.on('broadcast', { event: 'lobby_changed' }, callbacks.onChanged).subscribe((status) => callbacks.onConnection(status === 'SUBSCRIBED'));
  return async () => { await client.removeChannel(channel); };
}

