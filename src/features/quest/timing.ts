import { z } from 'zod';
import { QuestRoomSchema, type QuestRoom } from '../../../packages/contracts/src/quest';
import { ensureAnonymousSession } from '@/lib/auth';
import { edgeFunctionErrorMessage } from '@/lib/edge-function-error';
import { requireSupabase } from '@/lib/supabase';

export async function suggestTripPeriods(tripId: string): Promise<QuestRoom> {
  await ensureAnonymousSession();
  const { data, error } = await requireSupabase().functions.invoke('suggest-trip-period', { body: { tripId: z.uuid().parse(tripId) } });
  if (error) throw new Error(await edgeFunctionErrorMessage(error, 'Could not recommend trip dates. Try again.'));
  if (typeof data?.error === 'string') throw new Error(data.error);
  return QuestRoomSchema.parse(data);
}
