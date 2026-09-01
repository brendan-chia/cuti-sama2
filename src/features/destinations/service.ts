import { DestinationRequestSchema, DestinationResultSchema } from '../../../packages/contracts/src/destination';
import { ensureAnonymousSession } from '@/lib/auth';
import { requireSupabase } from '@/lib/supabase';

export async function loadDestinations(tripId: string) {
  await ensureAnonymousSession();
  const body = DestinationRequestSchema.parse({ tripId });
  const { data, error } = await requireSupabase().functions.invoke('recommend-destinations', { body });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return DestinationResultSchema.parse(data);
}

