import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { QuestRoom } from '../packages/contracts/src/quest';
import { ExploreSuggestions } from '@/features/quest/explore-suggestions';

const mockInvoke = jest.fn();
const mockConfirm = jest.fn();
jest.mock('@/lib/auth', () => ({ ensureAnonymousSession: async () => undefined }));
jest.mock('@/lib/supabase', () => ({ requireSupabase: () => ({ functions: { invoke: mockInvoke } }) }));
jest.mock('@/features/quest/place-import-service', () => ({ confirmTripPlaces: (...args: unknown[]) => mockConfirm(...args) }));
jest.mock('@/features/quest/planner-input', () => ({
  planQuest: () => ({ days: [{ estimatedScheduledMinutes: 0 }] }), questPlaces: () => [],
}));
const room = { tripId: '11111111-1111-4111-8111-111111111111', selectedCountryCode: 'JP' } as QuestRoom;
const candidate = { id: 'osm-way-123', name: 'City Garden', address: 'Tokyo, Japan', countryCode: 'JP', latitude: 35.7, longitude: 139.7, evidence: 'A peaceful garden', sourceUrl: 'https://tourism.example/garden' };
const importId = '22222222-2222-4222-8222-222222222222';
beforeEach(() => {
  jest.clearAllMocks();
  mockInvoke.mockResolvedValue({ data: { importId, places: [{ id: candidate.id, reason: candidate.evidence, candidate }] }, error: null });
});
it('renders an external place and only selects it after successful persistence', async () => {
  let resolve!: (value: QuestRoom) => void;
  mockConfirm.mockImplementation(() => new Promise<QuestRoom>(settle => { resolve = settle; }));
  const onAdd = jest.fn(), onConfirmed = jest.fn();
  const screen = await render(<ExploreSuggestions room={room} selectedIds={[]} disabled={false} onAdd={onAdd} onConfirmed={onConfirmed} />);
  await fireEvent.press(screen.getByText('Recommend more places'));
  await waitFor(() => expect(screen.getByText('City Garden')).toBeTruthy());
  expect(screen.getByLabelText('View source for City Garden')).toBeTruthy();
  await fireEvent.press(screen.getByText('Add City Garden'));
  expect(mockConfirm).toHaveBeenCalledWith(importId, [candidate.id]);
  expect(onAdd).not.toHaveBeenCalled();
  resolve(room);
  await waitFor(() => expect(onAdd).toHaveBeenCalledWith(candidate.id));
  expect(onConfirmed).toHaveBeenCalledWith(room);
});
it('keeps a failed addition available to retry without selecting it', async () => {
  mockConfirm.mockRejectedValue(new Error('Could not save this place'));
  const onAdd = jest.fn();
  const screen = await render(<ExploreSuggestions room={room} selectedIds={[]} disabled={false} onAdd={onAdd} onConfirmed={jest.fn()} />);
  await fireEvent.press(screen.getByText('Recommend more places'));
  await waitFor(() => expect(screen.getByText('Add City Garden')).toBeTruthy());
  await fireEvent.press(screen.getByText('Add City Garden'));
  await waitFor(() => expect(screen.getByText('Could not save this place')).toBeTruthy());
  expect(onAdd).not.toHaveBeenCalled();
  expect(screen.getByText('Add City Garden')).toBeTruthy();
});
