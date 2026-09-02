import { requireSupabase } from '@/lib/supabase';
import { clearIdentityMarker, getIdentityMarker, saveIdentityMarker } from '@/lib/secure-storage';

export class LostIdentityError extends Error {
  constructor() { super('The anonymous identity previously used on this device could not be recovered.'); this.name = 'LostIdentityError'; }
}

let restoring: Promise<Awaited<ReturnType<typeof restoreAnonymousSession>>> | null = null;

type IdentityClient = Pick<ReturnType<typeof requireSupabase>, 'auth'>;
type IdentityStorage = { getMarker: () => Promise<string | null>; saveMarker: (userId: string) => Promise<void> };

export async function recoverAnonymousSession(client: IdentityClient, storage: IdentityStorage) {
  const [{ data }, markerResult] = await Promise.all([client.auth.getSession(), storage.getMarker().then((value) => ({ value, available: true as const })).catch(() => ({ value: null, available: false as const }))]);
  if (data.session) { await storage.saveMarker(data.session.user.id).catch(() => undefined); return data.session; }
  if (!markerResult.available) throw new LostIdentityError();
  const marker = markerResult.value;
  if (marker) throw new LostIdentityError();
  const { data: anonymousData, error } = await client.auth.signInAnonymously();
  if (error) throw new Error(`Could not start a guest session: ${error.message}`);
  if (!anonymousData.session) throw new Error('Anonymous authentication did not return a session.');
  await storage.saveMarker(anonymousData.session.user.id); return anonymousData.session;
}

async function restoreAnonymousSession() {
  return recoverAnonymousSession(requireSupabase(), { getMarker: getIdentityMarker, saveMarker: saveIdentityMarker });
}

export async function ensureAnonymousSession() {
  restoring ??= restoreAnonymousSession().finally(() => { restoring = null; });
  return restoring;
}

export async function abandonLostIdentity() {
  const client = requireSupabase(); await client.auth.signOut().catch(() => undefined); await clearIdentityMarker();
}
