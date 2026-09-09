import { budgetCacheInput, sharedBudget } from '../supabase/functions/_shared/budget-cache';
it('uses the same key for equivalent departure spelling, but separates trip details and style', () => {
  expect(budgetCacheInput('same-trip', '  Kuala   Lumpur ', 'comfortable')).toBe(budgetCacheInput('same-trip', 'kuala lumpur', 'comfortable'));
  expect(budgetCacheInput('same-trip', 'Kuala Lumpur', 'budget')).not.toBe(budgetCacheInput('same-trip', 'Kuala Lumpur', 'comfortable'));
  expect(budgetCacheInput('different-dates', 'Kuala Lumpur', 'comfortable')).not.toBe(budgetCacheInput('same-trip', 'Kuala Lumpur', 'comfortable'));
});
it('reuses a saved estimate without another AI call', async () => {
  const generate = jest.fn();
  await expect(sharedBudget(async () => ({ total: 3000 }), generate, jest.fn())).resolves.toEqual({ total: 3000 });
  expect(generate).not.toHaveBeenCalled();
});
it('returns the same persisted estimate to two devices even when their AI drafts differ', async () => {
  let stored: { total: number } | null = null;
  const read = async () => stored;
  const insert = async (draft: { total: number }) => { stored ??= draft; };
  const [first, second] = await Promise.all([
    sharedBudget(read, async () => ({ total: 3000 }), insert),
    sharedBudget(read, async () => ({ total: 4200 }), insert),
  ]);
  expect(first).toEqual(second);
  expect(first).toEqual(stored);
});
it('does not expose an unpersisted estimate after a failed save', async () => {
  await expect(sharedBudget(async () => null, async () => ({ total: 3000 }), async () => {})).rejects.toThrow('Could not restore');
});
