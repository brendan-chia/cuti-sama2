import { FunctionsHttpError } from '@supabase/supabase-js';
import { ensureAnonymousSession, LostIdentityError } from '@/lib/auth';
import { requireSupabase } from '@/lib/supabase';

async function isExpiredToken(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  if ('message' in error && /(?:jwt|token).*expired|expired.*(?:jwt|token)/i.test(String(error.message))) {
    return true;
  }
  if (error instanceof FunctionsHttpError && error.context.status === 401) {
    try {
      const payload = await error.context.clone().json();
      return /(?:jwt|token).*expired|expired.*(?:jwt|token)/i.test(String(payload.message ?? payload.error ?? ''));
    } catch { return false; }
  }
  return false;
}

let refreshing: Promise<void> | null = null;
let refreshGeneration = 0;

async function renewSession() {
  refreshing ??= (async () => {
    const refreshed = await requireSupabase().auth.refreshSession();
    if (refreshed.error) throw new Error(`Could not renew your session: ${refreshed.error.message}`);
    if (!refreshed.data.session) throw new LostIdentityError();
    refreshGeneration++;
  })().finally(() => { refreshing = null; });
  await refreshing;
}

export async function withSessionRefresh<T extends { error: unknown }>(request: () => PromiseLike<T>): Promise<T> {
  await ensureAnonymousSession();
  const generation = refreshGeneration;
  const result = await request();
  if (!await isExpiredToken(result.error)) return result;
  // Concurrent requests may still return errors for the token already replaced.
  if (generation === refreshGeneration) await renewSession();
  const retried = await request();
  if (await isExpiredToken(retried.error)) throw new Error('Your session could not be renewed. Please reconnect and try again.');
  return retried;
}
