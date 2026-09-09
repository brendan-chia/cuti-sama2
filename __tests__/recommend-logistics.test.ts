import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { loadLogisticsRecommendations } from '@/features/quest/recommend-logistics';

const mockInvoke = jest.fn();
jest.mock('@/lib/supabase', () => ({ requireSupabase: () => ({ functions: { invoke: mockInvoke } }) }));
const input = { tripId: '11111111-1111-4111-8111-111111111111', kind: 'stays', direction: 'arrival' } as const;

beforeEach(() => mockInvoke.mockReset());

test('retries a connection failure once and gives the AI request an explicit timeout', async () => {
  mockInvoke.mockResolvedValueOnce({ data: null, error: new FunctionsFetchError(new Error('Network disconnected')) })
    .mockResolvedValueOnce({ data: { transport: [], stays: [] }, error: null });
  await expect(loadLogisticsRecommendations(input)).resolves.toEqual({ transport: [], stays: [] });
  expect(mockInvoke).toHaveBeenCalledTimes(2);
  expect(mockInvoke).toHaveBeenCalledWith('recommend-logistics', { body: input, timeout: 60000 });
});

test('preserves backend rate limits without automatically retrying', async () => {
  mockInvoke.mockResolvedValue({ data: null, error: new FunctionsHttpError({ json: async () => ({ error: 'AI is receiving too many requests. Please try again in a minute.' }) }) });
  await expect(loadLogisticsRecommendations(input)).rejects.toThrow('AI is receiving too many requests');
  expect(mockInvoke).toHaveBeenCalledTimes(1);
});

test('rejects an empty transport result with an actionable message', async () => {
  mockInvoke.mockResolvedValue({ data: { transport: [], stays: [] }, error: null });
  await expect(loadLogisticsRecommendations({ ...input, kind: 'transport' })).rejects.toThrow('The travel suggestions were incomplete. Please retry.');
});

test('rejects invalid provider payloads without exposing schema diagnostics', async () => {
  mockInvoke.mockResolvedValue({ data: { transport: [], stays: [{ name: 'Incomplete property' }] }, error: null });
  await expect(loadLogisticsRecommendations(input)).rejects.toThrow('The travel suggestions were incomplete. Please retry.');
});
