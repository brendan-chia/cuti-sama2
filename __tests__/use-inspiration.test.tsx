import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { UseInspiration } from '@/features/inspiration/use-inspiration';
const mockPush = jest.fn();
const mockQueue = jest.fn().mockResolvedValue(undefined);
const mockTrips = jest.fn();
const mockQuest = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/features/inspiration/planning', () => ({ queueInspiration: (...args: unknown[]) => mockQueue(...args) }));
jest.mock('@/features/profile/service', () => ({ loadMyTrips: () => mockTrips() }));
jest.mock('@/features/quest/service', () => ({ loadQuest: (id: string) => mockQuest(id) }));
beforeEach(() => { jest.clearAllMocks(); mockTrips.mockResolvedValue({ trips: [{ id: 'trip', name: 'Bangkok', travel_party: 'solo', planning_started_at: 'today' }], completed: new Set() }); mockQuest.mockResolvedValue({ stage: 'explore' }); });
it('queues inspiration before opening the selected trip', async () => {
  const screen = await render(<UseInspiration inspirationId="idea" />);
  await fireEvent.press(screen.getByText('Use these in a trip'));
  await waitFor(() => expect(screen.getByText('Use these in Bangkok')).toBeTruthy());
  await fireEvent.press(screen.getByText('Use these in Bangkok'));
  await waitFor(() => expect(mockQueue).toHaveBeenCalledWith('trip', 'idea'));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/trip/[tripId]', params: { tripId: 'trip', section: 'places' } });
});
it('passes inspiration to a new trip and keeps existing plans available', async () => {
  mockQuest.mockResolvedValue({ stage: 'budget' });
  const screen = await render(<UseInspiration inspirationId="idea" />);
  await fireEvent.press(screen.getByText('Use these in a trip'));
  await waitFor(() => expect(screen.queryByText('Preparing your trips…')).toBeNull());
  expect(screen.getByText('Use these in Bangkok')).toBeTruthy();
  await fireEvent.press(screen.getByText('Start a solo trip with these ideas'));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/solo', params: { inspirationId: 'idea' } });
  expect(mockQueue).not.toHaveBeenCalled();
});
