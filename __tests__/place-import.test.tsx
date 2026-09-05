import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { PlaceImportPanel } from '@/features/quest/place-import-panel';
import { normalizeSocialUrl, PlaceCandidateSchema } from '../packages/contracts/src/place-import';
import type { QuestRoom } from '../packages/contracts/src/quest';

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn(async () => ({ canceled: true })) }));
const candidate = { id: 'osm-node-123', name: 'Kek Lok Si Temple', address: 'Air Itam, Penang, Malaysia', countryCode: 'MY', latitude: 5.4, longitude: 100.3, evidence: 'Kek Lok Si Temple, Penang', sourceUrl: 'https://www.openstreetmap.org/node/123' };
const result = { importId: '11111111-1111-4111-8111-111111111111', candidates: [candidate], status: 'ready' as const, message: 'Check the address before confirming.' };

it('requires explicit selection and persists only the confirmed candidate IDs', async () => {
  const importAction = jest.fn(async () => result);
  const savedRoom = { revision: 2, importedPlaces: [candidate] } as unknown as QuestRoom;
  const confirmAction = jest.fn(async () => savedRoom); const onConfirmed = jest.fn();
  const screen = await render(<PlaceImportPanel tripId="trip" countryName="Malaysia" importAction={importAction} confirmAction={confirmAction} onConfirmed={onConfirmed} />);
  await fireEvent.press(screen.getByText('＋ Add a travel post'));
  await fireEvent.changeText(screen.getByLabelText('Caption or place names'), 'Kek Lok Si Temple, Penang');
  await fireEvent.press(screen.getByText('Find the places'));
  await waitFor(() => expect(screen.getByText('Kek Lok Si Temple')).toBeTruthy());
  expect(screen.getByRole('button', { name: 'Confirm 0 places' }).props.accessibilityState.disabled).toBe(true);
  expect(confirmAction).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText('Confirm Kek Lok Si Temple'));
  await fireEvent.press(screen.getByText('Confirm 1 place'));
  await waitFor(() => expect(onConfirmed).toHaveBeenCalledWith(savedRoom));
  expect(confirmAction).toHaveBeenCalledWith(result.importId, ['osm-node-123']);
});

it('offers caption fallback when a link yields no places', async () => {
  const screen = await render(<PlaceImportPanel tripId="trip" countryName="Malaysia" importAction={jest.fn(async () => ({ ...result, candidates: [], status: 'needs_input' as const, message: 'Paste a caption with place names.' }))} onConfirmed={jest.fn()} />);
  await fireEvent.press(screen.getByText('＋ Add a travel post'));
  await fireEvent.changeText(screen.getByLabelText('Social post link'), 'https://instagram.com/reel/example/');
  await fireEvent.press(screen.getByText('Find the places'));
  await waitFor(() => expect(screen.getByText('Paste a caption with place names.')).toBeTruthy());
  expect(screen.queryByText('Confirm 0 places')).toBeNull();
});

it('rejects unrelated links and out-of-range location coordinates', () => {
  expect(() => normalizeSocialUrl('https://localhost/private')).toThrow();
  expect(PlaceCandidateSchema.safeParse({ ...candidate, latitude: 999 }).success).toBe(false);
});
