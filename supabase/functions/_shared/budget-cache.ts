export function normalizeDeparture(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}
export function budgetCacheInput(context: string, departure: string, style: string) {
  return JSON.stringify(['priced-budget-v1', context, normalizeDeparture(departure), style]);
}
// Concurrent callers must return the persisted winner, never their private draft.
export async function sharedBudget<T>(read: () => Promise<T | null>, generate: () => Promise<T>, insertIfAbsent: (value: T) => Promise<void>): Promise<T> {
  const cached = await read();
  if (cached) return cached;
  await insertIfAbsent(await generate());
  const canonical = await read();
  if (!canonical) throw new Error('Could not restore the shared budget recommendation.');
  return canonical;
}
