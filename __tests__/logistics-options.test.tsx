import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { LogisticsOptions } from '@/features/quest/logistics-options';
import type { QuestRoom } from '../packages/contracts/src/quest';
const mockInvoke = jest.fn();
jest.mock('@/lib/auth', () => ({ ensureAnonymousSession: jest.fn().mockResolvedValue({}) }));
jest.mock('@/lib/supabase', () => ({ requireSupabase: () => ({ functions: { invoke: mockInvoke } }) }));
const room = { tripId: '11111111-1111-4111-8111-111111111111', members: [{}] } as QuestRoom;
const journey = { direction: 'arrival', mode: 'flight', departureLocation: 'KUL', arrivalLocation: 'NRT', departureAt: '2027-12-04T07:00:00+08:00', arrivalAt: '2027-12-04T14:30:00+09:00', cost: 850, bookingLink: 'https://www.google.com/search?q=flight', status: 'proposed' };
beforeEach(() => mockInvoke.mockReset());
test('loads journeys automatically and persists the selected option without form entry', async () => {
  mockInvoke.mockResolvedValue({ data: { transport: [{ label: 'Morning flight', reason: 'Arrive in time to explore.', journey }], stays: [] }, error: null });
  const act = jest.fn().mockResolvedValue(true);
  const screen = await render(<LogisticsOptions room={room} kind="transport" busy={false} act={act} />);
  await waitFor(() => expect(screen.getByText('Select Morning flight')).toBeTruthy());
  expect(act).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText('Select Morning flight'));
  expect(act).toHaveBeenCalledWith({ type: 'transport', transport: { ...journey, status: 'selected' } });
});
test('failed lists provide retry without saving fabricated data', async () => {
  mockInvoke.mockResolvedValueOnce({ data: null, error: new Error('Try again later') }).mockResolvedValueOnce({ data: { transport: [], stays: [] }, error: null });
  const act = jest.fn();
  const screen = await render(<LogisticsOptions room={room} kind="stays" busy={false} act={act} />);
  await waitFor(() => expect(screen.getByText('Try again later')).toBeTruthy());
  await fireEvent.press(screen.getByText('Retry suggestions'));
  await waitFor(() => expect(screen.getByText('No overnight stay is needed for a one-day trip.')).toBeTruthy());
  expect(act).not.toHaveBeenCalled();
});
test('adds an accommodation suggestion using its complete details', async () => {
  const stay = { id: '33333333-3333-4333-8333-333333333333', name: 'Example stay', area: 'Tokyo', image: 'https://example.com/stay.jpg', latitude: 35, longitude: 139, totalCost: 1050, checkIn: '2027-12-04', checkOut: '2027-12-08', rating: 0, distance: 'Verify location', bookingLink: 'https://www.google.com/search?q=stay', provider: 'AI planning estimate' };
  mockInvoke.mockResolvedValue({ data: { transport: [], stays: [{ stay, reason: 'Near your chosen stops.' }] }, error: null });
  const act = jest.fn().mockResolvedValue(true);
  const screen = await render(<LogisticsOptions room={room} kind="stays" busy={false} act={act} />);
  await waitFor(() => expect(screen.getByText('Add Example stay')).toBeTruthy());
  await fireEvent.press(screen.getByText('Add Example stay'));
  expect(act).toHaveBeenCalledWith({ type: 'stay', stay });
});
