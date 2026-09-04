import * as Crypto from 'expo-crypto';
import { sessionStorage, type AsyncStorageDriver } from '@/lib/secure-storage';
import { createUuid } from '@/lib/uuid';

type PendingOperation = { key: string; fingerprint: string; createdAt: string };
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([name, item]) => `${JSON.stringify(name)}:${stable(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
const storageKey = (operation: string, scope: string) => `cutisama2.operation.${operation}.${scope}`;

export function createIdempotencyStore(storage: AsyncStorageDriver, uuid = createUuid, digest = (value: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value), now = () => Date.now()) {
  return {
    async keyFor(operation: string, scope: string, input: unknown) {
      const fingerprint = await digest(stable(input)); const target = storageKey(operation, scope);
      try {
        const raw = await storage.getItem(target);
        if (raw) { const pending = JSON.parse(raw) as PendingOperation; if (pending.fingerprint === fingerprint && now() - Date.parse(pending.createdAt) < 86_400_000) return pending.key; }
      } catch { /* damaged metadata is safely replaced */ }
      const pending = { key: uuid(), fingerprint, createdAt: new Date(now()).toISOString() } satisfies PendingOperation;
      await storage.setItem(target, JSON.stringify(pending)); return pending.key;
    },
    async complete(operation: string, scope: string, operationKey: string) {
      const target = storageKey(operation, scope); const raw = await storage.getItem(target); if (!raw) return;
      try { if ((JSON.parse(raw) as PendingOperation).key === operationKey) await storage.removeItem(target); } catch { await storage.removeItem(target); }
    },
  };
}

export const idempotency = createIdempotencyStore(sessionStorage);
export async function withPersistentOperationKey<T>(operation: string, scope: string, input: unknown, action: (key: string) => Promise<T>) {
  const key = await idempotency.keyFor(operation, scope, input); const result = await action(key); await idempotency.complete(operation, scope, key); return result;
}
