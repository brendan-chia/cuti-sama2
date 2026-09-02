import * as Crypto from 'expo-crypto';

import { StoredItinerarySchema } from '../../../packages/contracts/src/itinerary';
import {
  ActivateItineraryRequestSchema,
  ActivateItineraryResponseSchema,
  ItineraryRevisionStateSchema,
  ReviseItineraryRequestSchema,
  ReviseItineraryResponseSchema,
  type RevisionInstruction,
} from '../../../packages/contracts/src/revision';
import { ensureAnonymousSession } from '@/lib/auth';
import { requireSupabase } from '@/lib/supabase';

export class VersionConflictError extends Error {
  constructor() { super('This itinerary changed in another session. Reload the latest active version before continuing.'); this.name = 'VersionConflictError'; }
}

function apiError(data: unknown, fallback: string) {
  const message = typeof data === 'object' && data !== null && 'error' in data ? String(data.error) : fallback;
  return message === 'VERSION_CONFLICT' ? new VersionConflictError() : new Error(message);
}

export async function loadRevisionState(tripId: string) {
  await ensureAnonymousSession();
  const { data, error } = await requireSupabase().rpc('get_itinerary_revision_state', { p_trip_id: tripId });
  if (error) throw new Error(error.message);
  return ItineraryRevisionStateSchema.parse(data);
}

export async function loadItineraryVersion(tripId: string, version: number) {
  await ensureAnonymousSession();
  const { data, error } = await requireSupabase().from('itinerary_versions').select('id,version_number,generated_at,content').eq('trip_id', tripId).eq('version_number', version).single();
  if (error) throw new Error(error.message);
  return StoredItinerarySchema.parse({ versionId: data.id, version: data.version_number, generatedAt: data.generated_at, itinerary: data.content });
}

export async function reviseItinerary(tripId: string, baseVersionId: string, instruction: RevisionInstruction, idempotencyKey = Crypto.randomUUID()) {
  await ensureAnonymousSession();
  const body = ReviseItineraryRequestSchema.parse({ tripId, baseVersionId, instruction, idempotencyKey });
  const { data, error } = await requireSupabase().functions.invoke('revise-itinerary', { body });
  if (error || data?.error) throw apiError(data, error?.message ?? 'Could not revise the itinerary.');
  return ReviseItineraryResponseSchema.parse(data);
}

export async function activateItinerary(tripId: string, versionId: string, expectedActiveVersionId: string) {
  await ensureAnonymousSession();
  const body = ActivateItineraryRequestSchema.parse({ tripId, versionId, expectedActiveVersionId });
  const { data, error } = await requireSupabase().functions.invoke('activate-itinerary', { body });
  if (error || data?.error) throw apiError(data, error?.message ?? 'Could not activate the itinerary.');
  return ActivateItineraryResponseSchema.parse(data);
}
