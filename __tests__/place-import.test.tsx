import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { PlaceImportPanel } from '@/features/quest/place-import-panel';
import { normalizeSocialUrl, PlaceCandidateSchema } from '../packages/contracts/src/place-import';
import type { QuestRoom } from '../packages/contracts/src/quest';

jest.mock('@/features/quest/video-import-service',()=>({latestVideoImport:jest.fn(async()=>null),startVideoImport:jest.fn(),videoStatus:jest.fn()}));

const mockPendingInspiration = jest.fn().mockResolvedValue(null);
jest.mock('@/features/inspiration/planning', () => ({ pendingInspiration: (...args: unknown[]) => mockPendingInspiration(...args), clearPendingInspiration: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/features/inspiration/service', () => ({ loadInspiration: jest.fn().mockResolvedValue([{ id: 'saved-idea', status: 'ready', analysis: { places: [{ name: 'Kek Lok Si Temple', location: 'Penang, Malaysia' }] } }]) }));

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn(async () => ({ canceled: true })) }));
const candidate = { id: 'osm-node-123', name: 'Kek Lok Si Temple', address: 'Air Itam, Penang, Malaysia', countryCode: 'MY', latitude: 5.4, longitude: 100.3, evidence: 'Kek Lok Si Temple, Penang', sourceUrl: 'https://www.openstreetmap.org/node/123' };
const result = { importId: '11111111-1111-4111-8111-111111111111', candidates: [candidate], status: 'ready' as const, message: 'Check the address before confirming.' };

it('requires explicit selection and persists only the confirmed candidate IDs', async () => {
  const importAction = jest.fn(async () => result);
  const savedRoom = { revision: 2, importedPlaces: [candidate] } as unknown as QuestRoom;
  const confirmAction = jest.fn(async () => savedRoom); const onConfirmed = jest.fn();
  const screen = await render(<PlaceImportPanel tripId="trip" countryName="Malaysia" importAction={importAction} confirmAction={confirmAction} onConfirmed={onConfirmed} />);
  await fireEvent.press(screen.getByText('＋ Add a travel post'));
  await fireEvent.changeText(screen.getByLabelText('Social post link'), 'https://youtube.com/watch?v=example');
  await fireEvent.press(screen.getByText('Find the places'));
  await waitFor(() => expect(screen.getByText('Kek Lok Si Temple')).toBeTruthy());
  expect(screen.getByRole('button', { name: 'Confirm 0 places' }).props.accessibilityState.disabled).toBe(true);
  expect(confirmAction).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText('Confirm Kek Lok Si Temple'));
  await fireEvent.press(screen.getByText('Confirm 1 place'));
  await waitFor(() => expect(onConfirmed).toHaveBeenCalledWith(savedRoom));
  expect(confirmAction).toHaveBeenCalledWith(result.importId, ['osm-node-123']);
});

it.each(['https://www.instagram.com/p/CxKCu0BPls7/?hl=en&img_index=3','https://instagram.com/reel/example/','https://www.tiktok.com/@traveller/video/12345','https://vm.tiktok.com/AbCd/'])('automatically analyses %s without extra input controls', async (url) => {
  const screen = await render(<PlaceImportPanel tripId="trip" countryName="Malaysia" importAction={jest.fn(async () => ({ ...result, candidates: [], status: 'needs_input' as const, message: 'Paste a caption with place names.' }))} onConfirmed={jest.fn()} />);
  await fireEvent.press(screen.getByText('＋ Add a travel post'));
  await fireEvent.changeText(screen.getByLabelText('Social post link'), url);
  expect(screen.getByTestId('video-import-panel')).toBeTruthy();
  expect(screen.queryByLabelText('Caption or place names')).toBeNull();
  expect(screen.queryByText('Upload a video')).toBeNull();
  expect(screen.queryByText('Add a screenshot')).toBeNull();
  expect(screen.queryByText('Switch to caption / screenshot reading')).toBeNull();
  expect(screen.queryByText('Confirm 0 places')).toBeNull();
});

it('rejects unrelated links and out-of-range location coordinates', () => {
  expect(() => normalizeSocialUrl('https://localhost/private')).toThrow();
  expect(PlaceCandidateSchema.safeParse({ ...candidate, latitude: 999 }).success).toBe(false);
});



it('queues automatic photo/carousel analysis with the same Find the places action as Reels', async () => {
  const service=jest.requireMock('@/features/quest/video-import-service');
  service.startVideoImport.mockResolvedValueOnce({importId:'post',state:'queued',processedFrames:0,totalFrames:0,audioDone:false,workerOnline:false,candidates:[],message:'Waiting for post analysis.'});
  const importAction=jest.fn();
  const screen=await render(<PlaceImportPanel tripId="trip" countryName="Malaysia" importAction={importAction} onConfirmed={jest.fn()} />);
  await fireEvent.press(screen.getByText('＋ Add a travel post'));
  const url='https://www.instagram.com/p/CxKCu0BPls7/?hl=en&img_index=3';
  await fireEvent.changeText(screen.getByLabelText('Social post link'),url);
  await fireEvent.press(screen.getByText('Find the places'));
  await waitFor(()=>expect(service.startVideoImport).toHaveBeenCalledWith('trip',url,''));
  expect(importAction).not.toHaveBeenCalled();
  await waitFor(()=>expect(screen.getByText('Waiting for post analysis.')).toBeTruthy());
});
it('offers a screenshot only as fallback after automatic post analysis fails', async () => {
  const service=jest.requireMock('@/features/quest/video-import-service');
  service.startVideoImport.mockRejectedValueOnce(new Error('Instagram did not expose the post.'));
  jest.requireMock('expo-image-picker').launchImageLibraryAsync.mockResolvedValueOnce({canceled:false,assets:[{base64:'/9j/AAAA'}]});
  const importAction=jest.fn(async()=>result);
  const screen=await render(<PlaceImportPanel tripId="trip" countryName="Malaysia" importAction={importAction} onConfirmed={jest.fn()} />);
  await fireEvent.press(screen.getByText('＋ Add a travel post'));
  await fireEvent.changeText(screen.getByLabelText('Social post link'),'https://www.instagram.com/p/CxKCu0BPls7/?img_index=3');
  await fireEvent.press(screen.getByText('Find the places'));
  await waitFor(()=>expect(screen.getByText('Use a caption or screenshot')).toBeTruthy());
  await fireEvent.press(screen.getByText('Use a caption or screenshot'));
  await fireEvent.press(screen.getByText('Add a screenshot'));
  await waitFor(()=>expect(screen.getByText('Replace screenshot')).toBeTruthy());
  await fireEvent.press(screen.getByText('Find the places'));
  await waitFor(()=>expect(importAction).toHaveBeenCalledWith('trip',{sourceUrl:'https://www.instagram.com/p/CxKCu0BPls7/?img_index=3',text:'',image:'data:image/jpeg;base64,/9j/AAAA'}));
});


it('prefills the inspiration queued for this trip and still requires location confirmation', async () => {
  mockPendingInspiration.mockResolvedValueOnce('saved-idea');
  const importAction = jest.fn(async () => result);
  const confirmAction = jest.fn();
  const screen = await render(<PlaceImportPanel tripId="inspired-trip" countryName="Malaysia" importAction={importAction} confirmAction={confirmAction} onConfirmed={jest.fn()} />);
  await waitFor(() => expect(screen.getByText('Kek Lok Si Temple, Penang, Malaysia')).toBeTruthy());
  await fireEvent.press(screen.getByText('Find the places'));
  await waitFor(() => expect(importAction).toHaveBeenCalledWith('inspired-trip', { sourceUrl: '', text: 'Kek Lok Si Temple, Penang, Malaysia', inspirationId: 'saved-idea' }));
  expect(confirmAction).not.toHaveBeenCalled();
});
