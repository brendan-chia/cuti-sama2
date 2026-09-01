import { cleanup, fireEvent, render } from '@testing-library/react-native';
import { useEffect } from 'react';

import type { VoteRoom } from '../packages/contracts/src/vote';
import { VotingScreen } from '@/features/voting/voting-screen';

const mockUseEffect = useEffect;
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void | (() => void)) => mockUseEffect(effect, []) }));

const tripId = '67e3c78c-a1e0-41c2-9f1c-582ed656d777';
const roundId = '57e3c78c-a1e0-41c2-9f1c-582ed656d778';
const options = [
  { optionId: 'penang', name: 'Penang', country: 'Malaysia', constraintScore: 105 },
  { optionId: 'danang', name: 'Da Nang', country: 'Vietnam', constraintScore: 103 },
];
const base: VoteRoom = { tripId, tripName: 'September escape', currentMemberId: '47e3c78c-a1e0-41c2-9f1c-582ed656d779', currentRole: 'organizer', phase: 'destination_voting', lockedDestination: null, round: { roundId, roundNumber: 1, status: 'open', options, participantCount: 4, votedCount: 2, ownVoteOptionId: null, totals: null, tiedOptionIds: [], winningOptionId: null, resolution: null, constraintComparison: null, closedAt: null } };
const subscribeAction = jest.fn(async (_room, callbacks) => { callbacks.onConnection(true); return async () => undefined; });
afterEach(async () => { jest.clearAllMocks(); await cleanup(); });

it('keeps totals hidden and lets a member submit one selected option', async () => {
  const submitAction = jest.fn(async () => ({ ...base, round: { ...base.round!, ownVoteOptionId: 'penang', votedCount: 3 } }));
  const screen = await render(<VotingScreen tripId={tripId} onBack={jest.fn()} loadAction={jest.fn(async () => base)} submitAction={submitAction} subscribeAction={subscribeAction} />);
  expect(await screen.findByText('Totals hidden · only participation is visible')).toBeTruthy();
  expect(screen.queryByText('0')).toBeNull();
  await fireEvent.press(screen.getByTestId('vote-option-penang')); await fireEvent.press(screen.getByTestId('submit-vote'));
  expect(submitAction).toHaveBeenCalledWith(tripId, roundId, 'penang');
});

it('offers both explicit tie paths and no random winner', async () => {
  const tied: VoteRoom = { ...base, round: { ...base.round!, status: 'tied', votedCount: 4, totals: [{ optionId: 'penang', total: 2 }, { optionId: 'danang', total: 2 }], tiedOptionIds: ['penang', 'danang'], closedAt: '2026-09-02T10:00:00Z' } };
  const screen = await render(<VotingScreen tripId={tripId} onBack={jest.fn()} loadAction={jest.fn(async () => tied)} subscribeAction={subscribeAction} />);
  expect(await screen.findByTestId('tie-path')).toBeTruthy();
  expect(screen.getByTestId('second-vote')).toBeTruthy(); expect(screen.getByTestId('compare-constraints')).toBeTruthy();
  expect(screen.queryByTestId('lock-winner')).toBeNull();
});

it('shows the itinerary invalidation warning before unlocking', async () => {
  const locked: VoteRoom = { ...base, phase: 'itinerary_planning', lockedDestination: { optionId: 'penang', name: 'Penang', country: 'Malaysia', lockedAt: '2026-09-02T10:00:00Z' }, round: { ...base.round!, status: 'closed', votedCount: 4, totals: [{ optionId: 'penang', total: 3 }, { optionId: 'danang', total: 1 }], winningOptionId: 'penang', resolution: 'majority', closedAt: '2026-09-02T10:00:00Z' } };
  const alert = jest.spyOn(require('react-native').Alert, 'alert');
  const screen = await render(<VotingScreen tripId={tripId} onBack={jest.fn()} loadAction={jest.fn(async () => locked)} subscribeAction={subscribeAction} />);
  await fireEvent.press(await screen.findByTestId('unlock-destination'));
  expect(alert).toHaveBeenCalledWith('Unlock destination?', expect.stringMatching(/itinerary may be invalidated/), expect.any(Array));
});
