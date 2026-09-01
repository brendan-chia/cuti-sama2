import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { useEffect } from 'react';

import type { PreferenceRound, TripRoom } from '../packages/contracts/src/preferences';
import { TripRoomScreen } from '@/features/trip-room/trip-room-screen';

const mockUseEffect = useEffect;
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void | (() => void)) => mockUseEffect(effect, []) }));
const tripId = '67e3c78c-a1e0-41c2-9f1c-582ed656d777';
const memberId = '11111111-1111-4111-8111-111111111111';
const round: PreferenceRound = {
  roundId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', sequence: 1, kind: 'vibe', status: 'collecting',
  createdAt: '2026-09-01T00:00:00Z', revealedAt: null, closedAt: null, participantCount: 2, submittedCount: 1,
  participants: [
    { memberId, displayName: 'Organiser', discriminator: 1, submitted: false, removed: false },
    { memberId: '22222222-2222-4222-8222-222222222222', displayName: 'Aina', discriminator: 1, submitted: true, removed: false },
  ], ownSubmission: null, revealedSubmissions: [],
};
const room: TripRoom = { tripId, tripName: 'Anywhere together', currentMemberId: memberId, currentRole: 'organizer', complete: false, currentRound: round };
const subscribe = jest.fn(async () => async () => undefined);

describe('TripRoomScreen', () => {
  beforeEach(() => { jest.clearAllMocks(); jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false); });
  afterEach(async () => { jest.restoreAllMocks(); await cleanup(); });

  it('shows readiness but no other hidden submission while collecting', async () => {
    const screen = await render(<TripRoomScreen tripId={tripId} onBack={jest.fn()} loadAction={jest.fn(async () => room)} submitAction={jest.fn()} manageAction={jest.fn()} subscribeAction={subscribe} />);
    await waitFor(() => screen.getByText('1 / 2 READY'));
    expect(screen.getByText('Aina')).toBeTruthy();
    expect(screen.queryByText('Aina hidden card')).toBeNull();
    expect(screen.getByTestId('submit-card').props.style).toBeTruthy();
  });

  it('always supports tap submission and updates an existing card before reveal', async () => {
    const submitted = { ...room, currentRound: { ...round, submittedCount: 2, ownSubmission: { value: 'Slow mornings', updatedAt: '2026-09-01T00:01:00Z' }, participants: round.participants.map((participant) => participant.memberId === memberId ? { ...participant, submitted: true } : participant) } };
    const submitAction = jest.fn(async () => submitted);
    const screen = await render(<TripRoomScreen tripId={tripId} onBack={jest.fn()} loadAction={jest.fn(async () => room)} submitAction={submitAction} manageAction={jest.fn()} subscribeAction={subscribe} />);
    await waitFor(() => screen.getByLabelText('Vibe answer'));
    await fireEvent.changeText(screen.getByLabelText('Vibe answer'), 'Slow mornings');
    await fireEvent.press(screen.getByTestId('submit-card'));
    await waitFor(() => expect(submitAction).toHaveBeenCalledWith({ tripId, roundId: round.roundId, value: 'Slow mornings' }));
  });

  it('renders all cards only after reveal and announces reduced motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const revealedRoom = { ...room, currentRound: { ...round, status: 'revealed' as const, revealedAt: '2026-09-01T00:02:00Z', revealedSubmissions: [
      { memberId, displayName: 'Organiser', discriminator: 1, value: 'Slow mornings', updatedAt: '2026-09-01T00:01:00Z' },
      { memberId: round.participants[1].memberId, displayName: 'Aina', discriminator: 1, value: 'Aina hidden card', updatedAt: '2026-09-01T00:01:30Z' },
    ] } };
    const screen = await render(<TripRoomScreen tripId={tripId} onBack={jest.fn()} loadAction={jest.fn(async () => revealedRoom)} submitAction={jest.fn()} manageAction={jest.fn()} subscribeAction={subscribe} />);
    await waitFor(() => screen.getByText('Cards revealed'));
    expect(screen.getByText('Aina hidden card')).toBeTruthy();
    expect(await screen.findByText('Reduced motion · transitions are immediate')).toBeTruthy();
  });
});
