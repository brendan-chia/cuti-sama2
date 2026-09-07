import { FunctionsFetchError } from '@supabase/supabase-js';
import { ensureAnonymousSession } from '@/lib/auth';
import { edgeFunctionErrorMessage } from '@/lib/edge-function-error';
import { requireSupabase } from '@/lib/supabase';
import { BudgetEstimateSchema } from '../../../packages/contracts/src/budget-recommendation';

export async function recommendBudget(input: { tripId: string; departure: string; style: 'budget' | 'comfortable' | 'premium' }) {
  await ensureAnonymousSession();
  const client = requireSupabase();
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await client.functions.invoke('recommend-budget', { body: input, timeout: 45000 });
    // This read-only estimate can safely retry a dropped connection once.
    // HTTP errors (including provider rate limits) must remain visible, not retried.
    if (error instanceof FunctionsFetchError && attempt === 0) {
      await new Promise(resolve => setTimeout(resolve, 600));
      continue;
    }
    if (error) throw new Error(await edgeFunctionErrorMessage(error, 'Could not recommend a budget. Please try again.'));
    const estimate = BudgetEstimateSchema.safeParse(data);
    if (!estimate.success) throw new Error('The budget response was incomplete. Please try again.');
    return estimate.data;
  }
  throw new Error('Could not connect to budget recommendations. Check your connection and try again.');
}
