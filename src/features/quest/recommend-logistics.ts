import { FunctionsFetchError } from '@supabase/supabase-js';
import { edgeFunctionErrorMessage } from '@/lib/edge-function-error';
import { requireSupabase } from '@/lib/supabase';
import { LogisticsRecommendationsSchema } from '../../../packages/contracts/src/logistics-recommendations';

type Request = { tripId: string; kind: 'transport' | 'stays'; direction: 'arrival' | 'departure'; departure?: string };

// The caller restores the session before reading its user-scoped cache.
export async function loadLogisticsRecommendations(input: Request) {
  const client = requireSupabase();
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await client.functions.invoke('recommend-logistics', { body: input, timeout: 60000 });
    if (error instanceof FunctionsFetchError && attempt === 0) {
      await new Promise(resolve => setTimeout(resolve, 600));
      continue;
    }
    if (error) throw new Error(await edgeFunctionErrorMessage(error, 'Could not load travel suggestions. Please retry.'));
    const parsed = LogisticsRecommendationsSchema.safeParse(data);
    if (!parsed.success || (input.kind === 'transport' && !parsed.data.transport.length)) {
      throw new Error('The travel suggestions were incomplete. Please retry.');
    }
    return parsed.data;
  }
  throw new Error('Could not connect to travel suggestions. Check your connection and try again.');
}
