import { z } from 'zod';
import { QuestRoomSchema, type QuestRoom } from '../../../packages/contracts/src/quest';
import { ensureAnonymousSession } from '@/lib/auth';
import { edgeFunctionErrorMessage } from '@/lib/edge-function-error';
import { requireSupabase } from '@/lib/supabase';

export async function suggestTripPeriods(tripId: string): Promise<QuestRoom> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('Finding dates took too long. Please check your connection and try again.'));
      controller.abort();
    }, 30000);
  });
  try {
    return await Promise.race([timeout, (async () => {
      await ensureAnonymousSession();
      if (controller.signal.aborted) throw new Error('Request timed out.');
      const { data, error } = await requireSupabase().functions.invoke('suggest-trip-period', { body: { tripId: z.uuid().parse(tripId) }, signal: controller.signal });
      if (error) throw new Error(await edgeFunctionErrorMessage(error, 'Could not recommend trip dates. Try again.'));
      if (typeof data?.error === 'string') throw new Error(data.error);
      return QuestRoomSchema.parse(data);
    })()]);
  } finally { clearTimeout(timer); }
}
