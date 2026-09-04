import { GroupMatchRequestSchema, GroupMatchResultSchema } from '../../../packages/contracts/src/group-match';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { z } from 'zod';
import { ensureAnonymousSession } from '@/lib/auth';
import { requireSupabase } from '@/lib/supabase';

export async function loadGroupMatch(tripId: string) {
  await ensureAnonymousSession();
  const body = GroupMatchRequestSchema.parse({ tripId });
  const { data, error } = await requireSupabase().functions.invoke('group-match', { body });
  if (error) {
    let message = error.message || 'Could not reveal the group match.';
    if (error instanceof FunctionsHttpError) {
      try {
        const payload = await error.context.json() as { error?: unknown };
        if (typeof payload.error === 'string') message = payload.error;
      } catch {
        // Retain the SDK error when the response has no readable JSON body.
      }
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  try {
    return GroupMatchResultSchema.parse(data);
  } catch (cause) {
    if (cause instanceof z.ZodError) throw new Error('The server returned the group match in an unexpected format.');
    throw cause;
  }
}
