import { PlaceImportRequestSchema, PlaceImportResultSchema } from '../../../packages/contracts/src/place-import';
import { QuestRoomSchema } from '../../../packages/contracts/src/quest';
import { withSessionRefresh } from '@/lib/session-request';
import { edgeFunctionErrorMessage } from '@/lib/edge-function-error';
import { requireSupabase } from '@/lib/supabase';
import { createUuid } from '@/lib/uuid';

export async function importTripPlaces(tripId: string, input: { sourceUrl: string; text: string; image?: string; inspirationId?: string }) {
  const body = PlaceImportRequestSchema.parse({ tripId, requestId: createUuid(), ...input });
  const { data, error } = await withSessionRefresh(() => requireSupabase().functions.invoke('import-trip-places', { body }));
  if (error) throw new Error(await edgeFunctionErrorMessage(error, 'Could not read this post. Try a caption or place names.'));
  if (data?.error) throw new Error(data.error);
  return PlaceImportResultSchema.parse(data);
}

export async function confirmTripPlaces(importId: string, placeIds: string[]) {
  const { data, error } = await withSessionRefresh(() => requireSupabase().rpc('confirm_trip_places', { p_import_id: importId, p_place_ids: placeIds }));
  if (error) throw new Error(error.message);
  return QuestRoomSchema.parse(data);
}
