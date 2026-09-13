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
  await waitFor(() => expect(screen.getByText('Select this journey')).toBeTruthy());
  expect(act).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText('Select this journey'));
  expect(act).not.toHaveBeenCalled();
  expect(screen.getByText('Your journey')).toBeTruthy();
  expect(screen.getByText('7:00 AM')).toBeTruthy();
  expect(screen.getByText('2:30 PM')).toBeTruthy();
  await fireEvent.press(screen.getByText('Save journey'));
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
test('shows accommodation details without a separate Add button', async () => {
  const stay = { id: '33333333-3333-4333-8333-333333333333', name: 'Example stay', area: 'Tokyo', image: 'https://example.com/stay.jpg', latitude: 35, longitude: 139, totalCost: 1050, checkIn: '2027-12-04', checkOut: '2027-12-08', rating: 0, distance: 'Verify location', bookingLink: 'https://www.google.com/search?q=stay', provider: 'AI planning estimate' };
  mockInvoke.mockResolvedValue({ data: { transport: [], stays: [{ stay, reason: 'Near your chosen stops.' }] }, error: null });
  const act = jest.fn().mockResolvedValue(true);
  const screen = await render(<LogisticsOptions room={room} kind="stays" busy={false} act={act} />);
  await waitFor(() => expect(screen.getByText('Example Stay')).toBeTruthy());
  expect(screen.queryByText('Add Example stay')).toBeNull();
  expect(act).not.toHaveBeenCalled();
});

test('switching alternatives updates the explanation and saves the visible journey', async () => {
  const alternative = { ...journey, mode: 'train', cost: 300 };
  mockInvoke.mockResolvedValue({ data: { transport: [
    { label: 'Morning flight', reason: 'Arrive in time to explore.', journey },
    { label: 'Scenic train', reason: 'Enjoy the scenery.', journey: alternative },
  ], stays: [] }, error: null });
  const act = jest.fn().mockResolvedValue(true);
  const screen = await render(<LogisticsOptions room={room} kind="transport" busy={false} act={act} />);
  await waitFor(() => expect(screen.getByText('Select this journey')).toBeTruthy());
  expect(screen.getByText('6h 30m')).toBeTruthy();
  expect(screen.getByText('4 Dec 2027')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Show option 2: Scenic train'));
  expect(screen.getByText('Enjoy the scenery.')).toBeTruthy();
  expect(screen.queryByText('Arrive in time to explore.')).toBeNull();
  await fireEvent.press(screen.getByText('Select this journey'));
  expect(act).not.toHaveBeenCalled();
  expect(screen.getByText('Your journey')).toBeTruthy();
  expect(screen.getByText('7:00 AM')).toBeTruthy();
  expect(screen.getByText('2:30 PM')).toBeTruthy();
  await fireEvent.press(screen.getByText('Save journey'));
  expect(act).toHaveBeenCalledWith({ type: 'transport', transport: { ...alternative, status: 'selected' } });
});


test('closing the preview does not save and a failed save keeps the details open', async () => {
  mockInvoke.mockResolvedValue({ data: { transport: [{ label: 'Morning flight', reason: 'Arrive in time to explore.', journey }], stays: [] }, error: null });
  const act = jest.fn().mockResolvedValue(false);
  const screen = await render(<LogisticsOptions room={room} kind="transport" busy={false} act={act} />);
  await waitFor(() => expect(screen.getByText('Select this journey')).toBeTruthy());
  expect(screen.queryByText('View live fares ↗')).toBeNull();
  await fireEvent.press(screen.getByText('Select this journey'));
  await fireEvent.press(screen.getByLabelText('Close journey details'));
  expect(act).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText('Select this journey'));
  await fireEvent.press(screen.getByText('Save journey'));
  await waitFor(() => expect(screen.getByText('Your journey could not be saved. Please try again.')).toBeTruthy());
  expect(screen.getByText('Save journey')).toBeTruthy();
});

 test.each([true, false])('selecting a solo stay confirms only after a successful save (%s)', async (saved) => {
  const stay = { id: '33333333-3333-4333-8333-333333333333', name: 'Example stay', area: 'Tokyo', image: 'https://example.com/stay.jpg', latitude: 35, longitude: 139, totalCost: 1050, checkIn: '2027-12-04', checkOut: '2027-12-08', rating: 0, distance: 'Verify location', bookingLink: 'https://example.com/stay', provider: 'AI planning estimate' };
  mockInvoke.mockResolvedValue({ data: { transport: [], stays: [{ category: 'cheap', stay, reason: 'Near your stops.' }] }, error: null });
  const act = jest.fn().mockResolvedValue(saved);
  const screen = await render(<LogisticsOptions room={{ ...room, travelParty: 'solo', currentRole: 'organizer' }} kind="stays" busy={false} act={act} />);
  await waitFor(() => expect(screen.getByText('Cheap')).toBeTruthy());
  await fireEvent.press(screen.getByText('Select stay & update budget'));
  expect(act).toHaveBeenNthCalledWith(1, { type: 'stay', stay });
  if (saved) expect(act).toHaveBeenNthCalledWith(2, { type: 'confirm_stay', stayId: stay.id });
  else expect(act).toHaveBeenCalledTimes(1);
 });

test('browses hotel cards with dots and swipes and selects the visible hotel', async () => {
  const base = { id: '33333333-3333-4333-8333-333333333333', name: 'First hotel', area: 'Tokyo', image: 'https://example.com/stay.jpg', latitude: 35, longitude: 139, totalCost: 1000, checkIn: '2027-12-04', checkOut: '2027-12-08', rating: 0, distance: 'Verify location', bookingLink: 'https://example.com/stay', provider: 'AI planning estimate' };
  const second = { ...base, id: '44444444-4444-4444-8444-444444444444', name: 'Second hotel', totalCost: 1500 };
  mockInvoke.mockResolvedValue({ data: { transport: [], stays: [{ stay: second, reason: 'More space.' }, { stay: base, reason: 'Lower price.' }] }, error: null });
  const act = jest.fn().mockResolvedValue(true);
  const screen = await render(<LogisticsOptions room={{ ...room, currentRole: 'organizer' }} kind="stays" busy={false} act={act} />);
  await waitFor(() => expect(screen.getByText('Hotel 1 of 2 · Swipe for alternatives')).toBeTruthy());
  expect(screen.getByText('First Hotel')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Show hotel 2: Second Hotel'));
  expect(screen.getByText('Hotel 2 of 2 · Swipe for alternatives')).toBeTruthy();
  expect(screen.getByText('Second Hotel')).toBeTruthy();
  await fireEvent.press(screen.getByText('Select stay & update budget'));
  await waitFor(() => expect(act).toHaveBeenNthCalledWith(2, { type: 'confirm_stay', stayId: second.id }));
  expect(act).toHaveBeenNthCalledWith(1, { type: 'stay', stay: second });
  await fireEvent(screen.getByTestId('stay-recommendation-cards'), 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: 0 } } });
  expect(screen.getByText('Hotel 1 of 2 · Swipe for alternatives')).toBeTruthy();
});
