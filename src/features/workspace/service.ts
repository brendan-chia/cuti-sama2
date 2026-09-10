import { z } from 'zod';
import { WorkspaceActionSchema, WorkspaceSchema, type WorkspaceAction } from '../../../packages/contracts/src/workspace';
import { ensureAnonymousSession } from '@/lib/auth';
import { requireSupabase } from '@/lib/supabase';
import { withPersistentOperationKey } from '@/lib/idempotency';
import { offlineCache } from '@/lib/offline-cache';
import { getIdentityMarker } from '@/lib/secure-storage';

export class WorkspaceAccessError extends Error {}
export async function readCachedWorkspace(tripId: string) {
  const identity = await getIdentityMarker();
  return identity ? offlineCache.read('workspace', `${identity}.${tripId}`, value => WorkspaceSchema.parse(value)) : null;
}

export async function loadWorkspace(tripId: string) {
  const session = await ensureAnonymousSession();
  const { data, error } = await requireSupabase().rpc('get_trip_workspace', { p_trip_id: z.uuid().parse(tripId) });
  if (error) {
    if (error.code === '42501') { await offlineCache.remove('workspace', `${session.user.id}.${tripId}`).catch(() => undefined); throw new WorkspaceAccessError(error.message); }
    throw new Error(error.code === 'PGRST202' ? 'The shared workspace update is not available on the planning service yet.' : error.message);
  }
  const workspace = WorkspaceSchema.parse(data);
  await offlineCache.write('workspace', `${session.user.id}.${tripId}`, workspace).catch(() => undefined);
  return workspace;
}
export async function updateWorkspace(tripId: string, revision: number, action: WorkspaceAction) {
  const session = await ensureAnonymousSession();
  const parsed = WorkspaceActionSchema.parse(action);
  return withPersistentOperationKey('workspace', tripId, { revision, action: parsed }, async key => {
    const { data, error } = await requireSupabase().rpc('update_trip_workspace', {
      p_trip_id: z.uuid().parse(tripId), p_revision: revision, p_action: parsed, p_key: key,
    });
    if (error) throw new Error(error.message);
    const workspace = WorkspaceSchema.parse(data);
    await offlineCache.write('workspace', `${session.user.id}.${tripId}`, workspace).catch(() => undefined);
    return workspace;
  });
}
