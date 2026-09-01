import { GroupMatchRequestSchema, GroupMatchResultSchema } from '../../../packages/contracts/src/group-match';
import { ensureAnonymousSession } from '@/lib/auth';
import { requireSupabase } from '@/lib/supabase';

export async function loadGroupMatch(tripId: string) {
  await ensureAnonymousSession();
  const body = GroupMatchRequestSchema.parse({ tripId });
  const { data, error } = await requireSupabase().functions.invoke('group-match', { body });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return GroupMatchResultSchema.parse(data);
}

