import { z } from 'zod';

import { sessionStorage, type AsyncStorageDriver } from '@/lib/secure-storage';

const CACHE_VERSION = 1;
const EnvelopeSchema = z.object({ cacheVersion: z.literal(CACHE_VERSION), savedAt: z.iso.datetime({ offset: true }), value: z.unknown() }).strict();

export type CachedState<T> = { value: T; savedAt: string; ageMs: number; stale: boolean };
const cacheKey = (namespace: string, scope: string) => `cutisama2.cache.${namespace}.${scope}`;

export function createOfflineCache(storage: AsyncStorageDriver, now = () => Date.now()) {
  return {
    async write<T>(namespace: string, scope: string, value: T) {
      await storage.setItem(cacheKey(namespace, scope), JSON.stringify({ cacheVersion: CACHE_VERSION, savedAt: new Date(now()).toISOString(), value }));
    },
    async read<T>(namespace: string, scope: string, parse: (value: unknown) => T, freshForMs = 15_000): Promise<CachedState<T> | null> {
      try {
        const raw = await storage.getItem(cacheKey(namespace, scope));
        if (!raw) return null;
        const envelope = EnvelopeSchema.parse(JSON.parse(raw)); const ageMs = Math.max(0, now() - Date.parse(envelope.savedAt));
        return { value: parse(envelope.value), savedAt: envelope.savedAt, ageMs, stale: ageMs > freshForMs };
      } catch {
        await storage.removeItem(cacheKey(namespace, scope)).catch(() => undefined); return null;
      }
    },
    remove(namespace: string, scope: string) { return storage.removeItem(cacheKey(namespace, scope)); },
  };
}

export const offlineCache = createOfflineCache(sessionStorage);
