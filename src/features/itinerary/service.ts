import { GenerateItineraryRequestSchema, GenerateItineraryResponseSchema, ItineraryStateSchema } from '../../../packages/contracts/src/itinerary';
import { ensureAnonymousSession } from '@/lib/auth';
import { idempotency } from '@/lib/idempotency';
import { requireSupabase } from '@/lib/supabase';
import { createUuid } from '@/lib/uuid';

export async function loadItineraryState(tripId: string) {
  await ensureAnonymousSession();
  const { data, error } = await requireSupabase().rpc('get_itinerary_state', { p_trip_id: tripId });
  if (error) throw new Error(error.message);
  return ItineraryStateSchema.parse(data);
}

export async function generateItinerary(tripId: string, idempotencyKey = createUuid()) {
  await ensureAnonymousSession();
  const body = GenerateItineraryRequestSchema.parse({ tripId, idempotencyKey });
  const { data, error } = await requireSupabase().functions.invoke('generate-itinerary', { body });
  if (error) throw new Error(data?.error ?? error.message);
  if (data?.error) throw new Error(data.error);
  const result = GenerateItineraryResponseSchema.parse(data);
  await idempotency.complete('generate', tripId, idempotencyKey);
  return result;
}

export function generationOperationKey(tripId: string) { return idempotency.keyFor('generate', tripId, { tripId }); }
