import { requireSupabase } from '@/lib/supabase';
import { clearIdentityMarker, getIdentityMarker, saveIdentityMarker } from '@/lib/secure-storage';

export class LostIdentityError extends Error {
  constructor() { super('The anonymous identity previously used on this device could not be recovered.'); this.name = 'LostIdentityError'; }
}

let restoring: Promise<Awaited<ReturnType<typeof restoreAnonymousSession>>> | null = null;

type IdentityClient = Pick<ReturnType<typeof requireSupabase>, 'auth'>;
type IdentityStorage = { getMarker: () => Promise<string | null>; saveMarker: (userId: string) => Promise<void> };

export async function recoverAnonymousSession(client: IdentityClient, storage: IdentityStorage) {
  const [{ data, error: sessionError }, markerResult] = await Promise.all([client.auth.getSession(), storage.getMarker().then((value) => ({ value, available: true as const })).catch(() => ({ value: null, available: false as const }))]);
  if (sessionError) throw new Error(`Could not restore your session: ${sessionError.message}`);
  if (data.session) {
    let session = data.session;
    if (session.expires_at !== undefined && session.expires_at <= Date.now() / 1000 + 60) {
      const refreshed = await client.auth.refreshSession();
      if (refreshed.error) throw new Error(`Could not renew your session: ${refreshed.error.message}`);
      if (!refreshed.data.session) throw new LostIdentityError();
      session = refreshed.data.session;
    }
    await storage.saveMarker(session.user.id).catch(() => undefined);
    return session;
  }
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
