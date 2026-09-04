import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { useEffect } from 'react';

import type { PreferenceRound, TripRoom } from '../packages/contracts/src/preferences';
import { TripRoomScreen } from '@/features/trip-room/trip-room-screen';

const mockUseEffect = useEffect;
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void | (() => void)) => mockUseEffect(effect, []) }));
const tripId = '67e3c78c-a1e0-41c2-9f1c-582ed656d777'; const memberId = '11111111-1111-4111-8111-111111111111';
const round: PreferenceRound = {
  roundId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', sequence: 1, kind: 'vibe', status: 'collecting', createdAt: '2026-09-01T00:00:00Z', revealedAt: null, closedAt: null, participantCount: 2, submittedCount: 1,
  participants: [{ memberId, displayName: 'Organiser', discriminator: 1, submitted: false, removed: false }, { memberId: '22222222-2222-4222-8222-222222222222', displayName: 'Aina', discriminator: 1, submitted: true, removed: false }], ownSubmission: null, revealedSubmissions: [],
};
const room: TripRoom = { tripId, tripName: 'Anywhere together', currentMemberId: memberId, currentRole: 'organizer', complete: false, currentRound: round };
const subscribe = jest.fn(async () => async () => undefined);

describe('TripRoomScreen', () => {
  beforeEach(() => { jest.clearAllMocks(); jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false); });
  afterEach(async () => { jest.restoreAllMocks(); await cleanup(); });

  it('shows a horizontal card hand and no typing interface for Vibe', async () => {
    const screen = await render(<TripRoomScreen tripId={tripId} onBack={jest.fn()} loadAction={jest.fn(async () => room)} submitAction={jest.fn()} manageAction={jest.fn()} subscribeAction={subscribe} />);
    await waitFor(() => screen.getByText('1 / 2 READY'));
    expect(screen.getByTestId('card-hand')).toBeTruthy(); expect(screen.getByTestId('preference-card-vibe-quiet')).toBeTruthy();
    expect(screen.queryByLabelText('Vibe answer')).toBeNull(); expect(screen.queryByText('Aina hidden card')).toBeNull();
  });

  it('plays a card directly without a separate Throw card action', async () => {
    const submitted: TripRoom = { ...room, currentRound: { ...round, submittedCount: 2, ownSubmission: { choiceId: 'quiet', customText: null, value: 'Quiet — peaceful places', updatedAt: '2026-09-01T00:01:00Z' }, participants: round.participants.map((item) => item.memberId === memberId ? { ...item, submitted: true } : item) } };
    const submitAction = jest.fn(async () => submitted);
    const screen = await render(<TripRoomScreen tripId={tripId} onBack={jest.fn()} loadAction={jest.fn(async () => room)} submitAction={submitAction} manageAction={jest.fn()} subscribeAction={subscribe} />);
    await waitFor(() => screen.getByTestId('preference-card-vibe-quiet')); expect(screen.queryByTestId('throw-card')).toBeNull(); await fireEvent.press(screen.getByTestId('preference-card-vibe-quiet'));
    await waitFor(() => expect(submitAction).toHaveBeenCalledWith({ tripId, roundId: round.roundId, roundType: 'vibe', choiceId: 'quiet', customText: null }));
  });

  it('renders hidden choices only after reveal', async () => {
    const revealed: TripRoom = { ...room, currentRound: { ...round, status: 'revealed', revealedAt: '2026-09-01T00:02:00Z', revealedSubmissions: [
      { memberId, displayName: 'Organiser', discriminator: 1, choiceId: 'quiet', customText: null, value: 'Quiet', updatedAt: '2026-09-01T00:01:00Z' },
      { memberId: round.participants[1].memberId, displayName: 'Aina', discriminator: 1, choiceId: 'lively', customText: null, value: 'Lively', updatedAt: '2026-09-01T00:01:30Z' },
    ] } };
    const screen = await render(<TripRoomScreen tripId={tripId} onBack={jest.fn()} loadAction={jest.fn(async () => revealed)} submitAction={jest.fn()} manageAction={jest.fn()} subscribeAction={subscribe} />);
    await waitFor(() => screen.getByText('Cards on the table')); expect(screen.getByText('Lively')).toBeTruthy();
  });

  it('opens custom input and plays the custom card after creation', async () => {
    const mustHaveRoom: TripRoom = { ...room, currentRound: { ...round, sequence: 3, kind: 'must_have' } };
    const submitAction = jest.fn(async () => mustHaveRoom);
    const screen = await render(<TripRoomScreen tripId={tripId} onBack={jest.fn()} loadAction={jest.fn(async () => mustHaveRoom)} submitAction={submitAction} manageAction={jest.fn()} subscribeAction={subscribe} />);
    await waitFor(() => screen.getByTestId('preference-card-must_have-custom')); expect(screen.queryByLabelText('Custom Must-Have')).toBeNull();
    await fireEvent.press(screen.getByTestId('preference-card-must_have-custom'));
    expect(screen.getByLabelText('Custom Must-Have')).toBeTruthy(); expect(screen.getByText('0 / 60')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Custom Must-Have'), 'See the cherry blossoms'); await fireEvent.press(screen.getByTestId('create-custom-card'));
    await waitFor(() => expect(submitAction).toHaveBeenCalledWith({ tripId, roundId: round.roundId, roundType: 'must_have', choiceId: 'custom', customText: 'See the cherry blossoms' }));
  });
});
