import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { BudgetRecommendation } from '@/features/quest/budget-recommendation';

const mockInvoke = jest.fn();
jest.mock('@/lib/auth', () => ({ ensureAnonymousSession: jest.fn().mockResolvedValue({}) }));
jest.mock('@/lib/supabase', () => ({ requireSupabase: () => ({ functions: { invoke: mockInvoke } }) }));
const estimate = { accommodation: 700, food: 300, localTransport: 100, activities: 200, returnTravel: 900, contingency: 220, assumptions: ['Four nights; return flights are estimates.'] };
beforeEach(() => mockInvoke.mockReset());
test('AI estimate needs explicit application and changing input discards it', async () => {
  mockInvoke.mockResolvedValue({ data: estimate, error: null });
  const apply = jest.fn();
  const screen = await render(<BudgetRecommendation tripId="trip-id" disabled={false} onApply={apply} />);
  await fireEvent.press(screen.getByText('Recommend my budget'));
  await waitFor(() => expect(screen.getByText('RM 2,420')).toBeTruthy());
  expect(mockInvoke).toHaveBeenCalledWith('recommend-budget', { body: { tripId: 'trip-id', departure: 'Kuala Lumpur', style: 'comfortable' }, timeout: 105000 });
  expect(apply).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText('Use this amount in my budget'));
  expect(apply).toHaveBeenCalledWith(2420);
  await fireEvent.changeText(screen.getByLabelText('Departure city'), 'Singapore');
  expect(screen.queryByText('Use this amount in my budget')).toBeNull();
});
test('AI failure leaves no fabricated estimate', async () => {
  mockInvoke.mockResolvedValue({ data: null, error: new Error('Unavailable') });
  const screen = await render(<BudgetRecommendation tripId="trip-id" disabled={false} onApply={jest.fn()} />);
  await fireEvent.press(screen.getByText('Recommend my budget'));
  await waitFor(() => expect(screen.getByText('Unavailable')).toBeTruthy());
  expect(screen.queryByText('Use this amount in my budget')).toBeNull();
});
