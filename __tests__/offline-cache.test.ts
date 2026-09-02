import { createOfflineCache } from '@/lib/offline-cache';

function memoryStorage() { const values = new Map<string, string>(); return { values, getItem: async (key: string) => values.get(key) ?? null, setItem: async (key: string, value: string) => { values.set(key, value); }, removeItem: async (key: string) => { values.delete(key); } }; }

it('reports cache freshness and preserves the last valid room state', async () => {
  const storage = memoryStorage(); let now = Date.parse('2026-09-02T10:00:00Z'); const cache = createOfflineCache(storage, () => now);
  await cache.write('room', 'trip-1', { count: 2 });
  expect(await cache.read('room', 'trip-1', (value) => value as { count: number }, 15_000)).toMatchObject({ value: { count: 2 }, stale: false, ageMs: 0 });
  now += 60_001;
  expect(await cache.read('room', 'trip-1', (value) => value as { count: number }, 15_000)).toMatchObject({ value: { count: 2 }, stale: true, ageMs: 60_001 });
});

it('discards invalid schema cache entries instead of showing corrupt state', async () => {
  const storage = memoryStorage(); const cache = createOfflineCache(storage); await cache.write('room', 'trip-1', { wrong: true });
  expect(await cache.read('room', 'trip-1', () => { throw new Error('schema'); })).toBeNull();
});
