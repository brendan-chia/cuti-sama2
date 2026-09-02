import type { CreateTripRequest, TripSummary } from '../../../packages/contracts/src/trip';

import { ensureAnonymousSession } from '@/lib/auth';
import { getLastTripId, saveLastTripId } from '@/lib/secure-storage';
import { requireSupabase } from '@/lib/supabase';
import { parseTripSummary } from '@/features/trips/validation';
import { idempotency } from '@/lib/idempotency';

export async function createTrip(request: CreateTripRequest): Promise<TripSummary> {
  await ensureAnonymousSession();
  const client = requireSupabase();
  const fingerprintInput = { ...request, idempotencyKey: undefined };
  const idempotencyKey = await idempotency.keyFor('create', 'new-trip', fingerprintInput);
  const { data, error } = await client.functions.invoke('create-trip', { body: { ...request, idempotencyKey } });

  if (error) throw new Error(error.message || 'Trip creation failed.');
  const trip = parseTripSummary(data);
  await idempotency.complete('create', 'new-trip', idempotencyKey);
  await saveLastTripId(trip.tripId);
  return trip;
}

export async function loadTrip(tripId: string): Promise<TripSummary | null> {
  const client = requireSupabase();
  await ensureAnonymousSession();

  const { data, error } = await client
    .from('trips')
    .select('id, name, mode, status, starts_on, ends_on, trip_destinations(name, sort_order)')
    .eq('id', tripId)
    .order('sort_order', { referencedTable: 'trip_destinations', ascending: true })
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const { data: member, error: memberError } = await client
    .from('trip_members')
    .select('id')
    .eq('trip_id', tripId)
    .eq('user_id', (await client.auth.getUser()).data.user?.id ?? '')
    .eq('active', true)
    .single();

  if (memberError) throw new Error(memberError.message);

  return parseTripSummary({
    tripId: data.id,
    memberId: member.id,
    tripName: data.name,
    mode: data.mode,
    status: data.status,
    destinations: (data.trip_destinations ?? []).map((item) => item.name),
    startsOn: data.starts_on,
    endsOn: data.ends_on,
  });
}

export { getLastTripId };
