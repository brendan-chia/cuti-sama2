import { periodLength, TripPeriodRequestSchema, TripPeriodSuggestionsSchema, type TripPeriodSuggestions } from '../../../packages/contracts/src/trip-period';
import { ensureAnonymousSession } from '@/lib/auth';
import { edgeFunctionErrorMessage } from '@/lib/edge-function-error';
import { requireSupabase } from '@/lib/supabase';

export async function suggestTripPeriods(tripId: string, durationDays = 5): Promise<TripPeriodSuggestions> {
  const body = TripPeriodRequestSchema.parse({ tripId, durationDays });
  await ensureAnonymousSession();
  const { data, error } = await requireSupabase().functions.invoke('suggest-trip-period', { body });
  if (error) throw new Error(await edgeFunctionErrorMessage(error, 'Could not suggest trip dates. Try again.'));
  if (typeof data?.error === 'string') throw new Error(data.error);
  const result = TripPeriodSuggestionsSchema.safeParse(data);
  if (!result.success || result.data.periods.some((period) => periodLength(period) !== durationDays)) {
    throw new Error('The server returned unexpected trip dates. Please try again.');
  }
  return result.data;
}
