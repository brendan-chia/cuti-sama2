import { createIdempotencyStore } from '@/lib/idempotency';

function memoryStorage() { const values = new Map<string, string>(); return { getItem: async (key: string) => values.get(key) ?? null, setItem: async (key: string, value: string) => { values.set(key, value); }, removeItem: async (key: string) => { values.delete(key); } }; }

it('reuses a pending key for the same mutation and rotates it only after completion', async () => {
  let sequence = 0; const store = createIdempotencyStore(memoryStorage(), () => `key-${++sequence}`, async (value) => value, () => 1_000);
  const first = await store.keyFor('submit-card', 'trip.round', { value: 'Museums' });
  expect(await store.keyFor('submit-card', 'trip.round', { value: 'Museums' })).toBe(first);
  expect(await store.keyFor('submit-card', 'trip.round', { value: 'Beaches' })).not.toBe(first);
  const current = await store.keyFor('submit-card', 'trip.round', { value: 'Beaches' }); await store.complete('submit-card', 'trip.round', current);
  expect(await store.keyFor('submit-card', 'trip.round', { value: 'Beaches' })).not.toBe(current);
});

it.each(['create', 'submit-card', 'submit-vote', 'generate', 'revise'])('retains duplicate %s operation keys while pending', async (operation) => {
  const store = createIdempotencyStore(memoryStorage(), () => 'same-key', async (value) => value);
  expect(await store.keyFor(operation, 'scope', { input: 1 })).toBe(await store.keyFor(operation, 'scope', { input: 1 }));
});
