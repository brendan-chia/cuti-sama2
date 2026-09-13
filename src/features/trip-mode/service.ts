import { TripModeDataSchema, TripModeStateSchema, type TripModeData } from '../../../packages/contracts/src/trip-mode';
import { ensureAnonymousSession } from '@/lib/auth';
import { withSessionRefresh } from '@/lib/session-request';
import { requireSupabase } from '@/lib/supabase';
export async function loadTripMode(tripId: string, questRevision: number) {
  await ensureAnonymousSession();
  const { data, error } = await withSessionRefresh(() => requireSupabase().rpc('get_trip_mode', { p_trip_id: tripId, p_quest_revision: questRevision }));
  if (error) throw new Error(error.message);
  return TripModeStateSchema.parse(data);
}
export async function saveTripMode(tripId: string, questRevision: number, revision: number, value: TripModeData) {
  await ensureAnonymousSession();
  const { data, error } = await withSessionRefresh(() => requireSupabase().rpc('save_trip_mode', { p_trip_id: tripId, p_quest_revision: questRevision, p_revision: revision, p_data: TripModeDataSchema.parse(value) }));
  if (error) throw new Error(error.message);
  return TripModeStateSchema.parse(data);
}
