import { GenerateItineraryRequestSchema, GenerateItineraryResponseSchema, ItineraryStateSchema } from '../../../packages/contracts/src/itinerary';
import { z } from 'zod';
import { ensureAnonymousSession } from '@/lib/auth';
import { edgeFunctionErrorMessage } from '@/lib/edge-function-error';
import { idempotency } from '@/lib/idempotency';
import { requireSupabase } from '@/lib/supabase';
import { createUuid } from '@/lib/uuid';

export async function loadItineraryState(tripId: string) {
  await ensureAnonymousSession();
  const { data, error } = await requireSupabase().rpc('get_planning_itinerary_state', { p_trip_id: tripId });
  if (error) throw new Error(error.message);
  return ItineraryStateSchema.parse(data);
}

export async function generateItinerary(tripId: string, idempotencyKey = createUuid()) {
  await ensureAnonymousSession();
  const body = GenerateItineraryRequestSchema.parse({ tripId, idempotencyKey });
  const { data, error } = await requireSupabase().functions.invoke('generate-itinerary', { body });
  if (error) throw new Error(typeof data?.error === 'string' ? data.error : await edgeFunctionErrorMessage(error, 'Could not generate the itinerary.'));
  if (data?.error) throw new Error(data.error);
  let result;
  try { result = GenerateItineraryResponseSchema.parse(data); }
  catch (cause) {
    if (cause instanceof z.ZodError) throw new Error('The server returned the itinerary in an unexpected format.');
    throw cause;
  }
  await idempotency.complete('generate', tripId, idempotencyKey);
  return result;
}

export function generationOperationKey(tripId: string, lockedAt?: string) { return idempotency.keyFor('generate', tripId, { tripId, lockedAt }); }
