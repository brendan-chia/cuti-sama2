import { useEffect } from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { WorkspaceScreen } from '@/features/workspace/workspace-screen';
import type { Workspace } from '../packages/contracts/src/workspace';

const mockEffect = useEffect;
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useFocusEffect: (fn: () => void) => mockEffect(fn, []), useRouter: () => ({ push: mockPush, replace: mockPush }) }));
jest.mock('@/features/workspace/inspiration-review', () => ({ InspirationReview: () => null }));
const tripId = '20000000-0000-4000-8000-000000000001';
const organizer = '30000000-0000-4000-8000-000000000001';
const member = '30000000-0000-4000-8000-000000000002';
const room: Workspace = {
  tripId, tripName: 'Ipoh weekend', travelParty: 'group', currentMemberId: organizer, currentRole: 'organizer',
  revision: 0, updatedAt: '2026-09-10T12:00:00Z', needsReview: false, legacyStarted: false,
  members: [{ memberId: organizer, name: 'Aina', role: 'organizer' }, { memberId: member, name: 'Ben', role: 'member' }],
  decisions: ['dates', 'destination', 'budget'].map(kind => ({ kind: kind as 'dates' | 'destination' | 'budget', version: 1, status: 'collecting', confirmed: null, previous: null, responses: [] })),
  places: [], bookings: [],
};
afterEach(async () => { await cleanup(); jest.clearAllMocks(); });

it('lets an organiser save a place while nobody has responded to decisions', async () => {
  const update = jest.fn(async () => room);
  const screen = await render(<WorkspaceScreen tripId={tripId} loadAction={jest.fn(async () => room)} updateAction={update} />);
  await fireEvent.press(await screen.findByRole('tab', { name: 'Places' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Add a place' }));
  await fireEvent.changeText(screen.getByLabelText('Place name'), 'Concubine Lane');
  await fireEvent.changeText(screen.getByLabelText('City or address'), 'Ipoh');
  await fireEvent.press(screen.getByRole('button', { name: 'Save place' }));
  await waitFor(() => expect(update).toHaveBeenCalledWith(tripId, 0, expect.objectContaining({ type: 'place', place: expect.objectContaining({ name: 'Concubine Lane', day: null, time: null }) })));
});

it('retains a local edit after a failed save', async () => {
  const screen = await render(<WorkspaceScreen tripId={tripId} initialSection="places" loadAction={jest.fn(async () => room)} updateAction={jest.fn(async () => { throw new Error('Could not save your changes.'); })} />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Add a place' }));
  await fireEvent.changeText(screen.getByLabelText('Place name'), 'A place to keep');
  await fireEvent.press(screen.getByRole('button', { name: 'Save place' }));
  await screen.findByText('Could not save your changes.');
  expect(screen.getByLabelText('Place name').props.value).toBe('A place to keep');
});

it('shows missing responses and does not allow premature confirmation', async () => {
  const screen = await render(<WorkspaceScreen tripId={tripId} loadAction={jest.fn(async () => room)} />);
  await fireEvent.press(await screen.findByLabelText('Budget, 0 of 2 responded'));
  expect(screen.getByRole('button', { name: 'Confirm shared decision' }).props.accessibilityState.disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Save my response' }).props.accessibilityState.disabled).toBe(false);
  expect(screen.getAllByText('Not responded')).toHaveLength(2);
});

it('keeps booking mutation controls away from group members', async () => {
  const screen = await render(<WorkspaceScreen tripId={tripId} initialSection="bookings" loadAction={jest.fn(async () => ({ ...room, currentMemberId: member, currentRole: 'member' as const }))} />);
  await screen.findByText('Transport and stays');
  expect(screen.queryByRole('button', { name: 'Add booking details' })).toBeNull();
});


it('does not silently retry a stale draft against a newer revision', async () => {
  const load = jest.fn().mockResolvedValueOnce(room).mockResolvedValue({ ...room, revision: 1 });
  const update = jest.fn(async () => { throw new Error('Another traveller changed this trip.'); });
  const screen = await render(<WorkspaceScreen tripId={tripId} initialSection="places" loadAction={load} updateAction={update} />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Add a place' }));
  await fireEvent.changeText(screen.getByLabelText('Place name'), 'Keep my draft');
  await fireEvent.press(screen.getByRole('button', { name: 'Save place' }));
  await screen.findByRole('button', { name: 'Discard draft and review latest version' });
  await fireEvent.press(screen.getByRole('button', { name: 'Save place' }));
  expect(update).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Place name').props.value).toBe('Keep my draft');
  await fireEvent.press(screen.getByRole('button', { name: 'Discard draft and review latest version' }));
  expect(screen.queryByLabelText('Place name')).toBeNull();
});
