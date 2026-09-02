import * as Crypto from 'expo-crypto';

import { GenerateItineraryRequestSchema, GenerateItineraryResponseSchema, ItineraryStateSchema } from '../../../packages/contracts/src/itinerary';
import { ensureAnonymousSession } from '@/lib/auth';
import { requireSupabase } from '@/lib/supabase';

export async function loadItineraryState(tripId: string) {
  await ensureAnonymousSession();
  const { data, error } = await requireSupabase().rpc('get_itinerary_state', { p_trip_id: tripId });
  if (error) throw new Error(error.message);
  return ItineraryStateSchema.parse(data);
}

export async function generateItinerary(tripId: string, idempotencyKey = Crypto.randomUUID()) {
  await ensureAnonymousSession();
  const body = GenerateItineraryRequestSchema.parse({ tripId, idempotencyKey });
  const { data, error } = await requireSupabase().functions.invoke('generate-itinerary', { body });
  if (error) throw new Error(data?.error ?? error.message);
  if (data?.error) throw new Error(data.error);
  return GenerateItineraryResponseSchema.parse(data);
}
