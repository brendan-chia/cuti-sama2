import { z } from 'zod';
import { QuestActionSchema, QuestRoomSchema, type QuestAction, type QuestRoom } from '../../../packages/contracts/src/quest';
import { ensureAnonymousSession } from '@/lib/auth';
import { withPersistentOperationKey } from '@/lib/idempotency';
import { requireSupabase } from '@/lib/supabase';

export async function loadQuest(tripId: string): Promise<QuestRoom> {
  await ensureAnonymousSession();
  const { data, error } = await requireSupabase().rpc('get_trip_quest', { p_trip_id: z.uuid().parse(tripId) });
  if (error) throw new Error(error.message);
  return QuestRoomSchema.parse(data);
}

export async function updateQuest(tripId: string, action: QuestAction): Promise<QuestRoom> {
  const parsed = QuestActionSchema.parse(action);
  const id = z.uuid().parse(tripId);
  await ensureAnonymousSession();
  const scope = `${id}.${parsed.type}${parsed.type === 'vote' ? `.${parsed.countryCode}` : ''}`;
  return withPersistentOperationKey('trip-quest', scope, parsed, async (idempotencyKey) => {
    const { data, error } = await requireSupabase().rpc('update_trip_quest', {
      p_trip_id: id, p_action: parsed, p_idempotency_key: idempotencyKey,
    });
    if (error) throw new Error(error.message);
    return QuestRoomSchema.parse(data);
  });
}

export async function subscribeToQuest(tripId: string, onChanged: () => void): Promise<() => Promise<unknown>> {
  await ensureAnonymousSession();
  const client = requireSupabase();
  await client.realtime.setAuth();
  const channel = client.channel(`trip:${z.uuid().parse(tripId)}:quest`, { config: { private: true } });
  channel.on('broadcast', { event: 'quest_changed' }, onChanged).subscribe((status) => {
    // A fresh snapshot on reconnect covers events missed while the app was suspended.
    if (status === 'SUBSCRIBED') onChanged();
  });
  return () => client.removeChannel(channel);
}
