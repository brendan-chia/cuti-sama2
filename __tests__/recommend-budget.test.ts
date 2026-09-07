import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { recommendBudget } from '@/features/quest/recommend-budget';
const mockInvoke = jest.fn();
jest.mock('@/lib/auth', () => ({ ensureAnonymousSession: jest.fn().mockResolvedValue({}) }));
jest.mock('@/lib/supabase', () => ({ requireSupabase: () => ({ functions: { invoke: mockInvoke } }) }));
const input = { tripId: 'trip-id', departure: 'Kuala Lumpur', style: 'comfortable' as const };
const estimate = { accommodation: 700, food: 300, localTransport: 100, activities: 200, returnTravel: 900, contingency: 220, assumptions: ['Four nights.'] };
beforeEach(() => mockInvoke.mockReset());
test('recovers once when the network request fails before a response', async () => {
  mockInvoke.mockResolvedValueOnce({ error: new FunctionsFetchError(new TypeError('Failed to fetch')) }).mockResolvedValueOnce({ data: estimate, error: null });
  await expect(recommendBudget(input)).resolves.toEqual(estimate);
  expect(mockInvoke).toHaveBeenCalledTimes(2);
});
test('stops after two connection failures and gives an actionable message', async () => {
  mockInvoke.mockResolvedValue({ error: new FunctionsFetchError(new TypeError('Failed to fetch')) });
  await expect(recommendBudget(input)).rejects.toThrow('Check your internet connection');
  expect(mockInvoke).toHaveBeenCalledTimes(2);
});
test('preserves server errors without automatically resending an AI request', async () => {
  mockInvoke.mockResolvedValue({ error: new FunctionsHttpError(new Response(JSON.stringify({ error: 'AI is busy. Retry in a minute.' }), { status: 503 })) });
  await expect(recommendBudget(input)).rejects.toThrow('AI is busy. Retry in a minute.');
  expect(mockInvoke).toHaveBeenCalledTimes(1);
});
