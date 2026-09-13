import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import type { QuestRoom, TripPeriod } from '../packages/contracts/src/quest';
import type { TripModeData } from '../packages/contracts/src/trip-mode';
import { TripModeScreen } from '@/features/trip-mode/trip-mode-screen';
import { ItineraryPlan } from '@/features/quest/itinerary-plan';
const mockUseEffect = useEffect;
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useFocusEffect: (effect: () => void | (() => void)) => mockUseEffect(effect, [effect]) }));
jest.mock('@/features/quest/planner-input', () => ({
  questPlaces: () => [
    { id: 'park', name: 'Park', countryId: 'JP', category: 'Nature', indoorOutdoor: 'outdoor', latitude: 35, longitude: 139, estimatedDurationMinutes: 180, estimatedCostMYR: 20 },
    { id: 'museum', name: 'Museum', countryId: 'JP', category: 'Culture', indoorOutdoor: 'indoor', latitude: 35.001, longitude: 139, estimatedDurationMinutes: 60, estimatedCostMYR: 42 },
  ],
  planQuest: () => ({ days: mockData.days, warnings: [] }),
}));
const organizerId = '11111111-1111-4111-8111-111111111111';
const memberId = '22222222-2222-4222-8222-222222222222';
const tripId = '67e3c78c-a1e0-41c2-9f1c-582ed656d777';
const period: TripPeriod = { startsOn: '2027-12-04', endsOn: '2027-12-08', label: 'Five days together', reason: 'Fits the shared calendar with two weekend days.' };
const baseRoom: QuestRoom = {
  tripId, tripName: 'The annual escape', currentMemberId: organizerId, currentRole: 'organizer',
  stage: 'picks', revision: 1, plannerVersion: '1.0',
  members: [
    { memberId: organizerId, displayName: 'Organiser', availabilitySubmitted: true, picksSubmitted: false, votesSubmitted: false, budgetSubmitted: false },
    { memberId, displayName: 'Aina', availabilitySubmitted: true, picksSubmitted: false, votesSubmitted: false, budgetSubmitted: false },
  ],
  ownAvailability: { startsOn: '2027-12-01', endsOn: '2027-12-31' },
  sharedAvailability: { startsOn: '2027-12-01', endsOn: '2027-12-31' }, period,
  ownPicks: [], countries: [], ownVotes: {}, results: [], tiedCountryCodes: [], selectedCountryCode: null,
  attractionIds: [], ownBudget: null, budgetSummary: null,
};

const room: QuestRoom = { ...baseRoom, stage: 'complete', selectedCountryCode: 'JP' };
const mockData: TripModeData = { days: [{ date: '2027-12-04', stops: [{ attractionId: 'park', estimatedStartTime: '09:00', estimatedEndTime: '13:00', estimatedVisitMinutes: 180, estimatedTravelMinutesFromPrevious: 0, includedMealBreakMinutes: 60 }], estimatedActivityCostMYR: 20, estimatedScheduledMinutes: 240, reservedMealBreakMinutes: 0 }], completedIds: [] };
async function open(role: 'organizer' | 'member' = 'organizer', failure = false) {
  const loadRoom = jest.fn(async () => ({ ...room, currentRole: role }));
  const loadAction = jest.fn(async () => ({ revision: 0, data: mockData }));
  const saveAction = jest.fn(async (_id: string, _quest: number, revision: number, data: TripModeData) => { if (failure) throw new Error('Your crew updated this trip. Reload before applying changes.'); return { revision: revision + 1, data }; });
  const screen = await render(<TripModeScreen tripId={room.tripId} onBack={jest.fn()} loadRoom={loadRoom} loadAction={loadAction} saveAction={saveAction} />);
  await waitFor(() => expect(screen.getByText('Next')).toBeTruthy());
  return { screen, saveAction };
}
test('generated itinerary no longer exposes the moved change-plan entry', async () => {
  const screen = await render(<ItineraryPlan room={room} />);
  expect(screen.queryByText('View trip')).toBeNull();
  expect(screen.getByText('Your day-by-day trip')).toBeTruthy();
});
test('previews rain replacement without saving, cancels, then applies and completes', async () => {
  const { screen, saveAction } = await open();
  const preview = async () => { await fireEvent.press(screen.getByText('🚨 Plans changed')); await fireEvent.press(screen.getByRole('radio', { name: 'Bad weather' })); await fireEvent.press(screen.getByText('Rescue my day')); };
  await preview(); expect(screen.getAllByText('Museum')).toHaveLength(2); expect(saveAction).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText('Keep current plan')); expect(screen.queryByTestId('rescue-preview')).toBeNull();
  await preview(); await fireEvent.press(screen.getByText('Use New Plan'));
  await waitFor(() => expect(saveAction).toHaveBeenCalledTimes(1));
  expect(saveAction.mock.calls[0][3].days[0].stops[0].attractionId).toBe('museum');
  await fireEvent.press(screen.getByText('Mark completed'));
  await waitFor(() => expect(screen.getByText('✓ Completed')).toBeTruthy());
  expect(saveAction.mock.calls[1][2]).toBe(1);
});
test('members can preview but cannot apply shared rescue', async () => {
  const { screen, saveAction } = await open('member');
  await fireEvent.press(screen.getByText('🚨 Plans changed')); await fireEvent.press(screen.getByRole('radio', { name: 'Bad weather' })); await fireEvent.press(screen.getByText('Rescue my day'));
  await fireEvent.press(screen.getByText('Use New Plan')); expect(saveAction).not.toHaveBeenCalled(); expect(screen.queryByText('Mark completed')).toBeNull();
});
test('save conflicts leave the old timeline intact and offer reload', async () => {
  const { screen } = await open('organizer', true);
  await fireEvent.press(screen.getByText('Mark completed'));
  await waitFor(() => expect(screen.getByText('Reload trip')).toBeTruthy());
  expect(screen.getByText('Next')).toBeTruthy(); expect(screen.queryByText('✓ Completed')).toBeNull();
});

test('My trips entry opens rescue options immediately without saving', async () => {
  const saveAction = jest.fn();
  const screen = await render(<TripModeScreen tripId={room.tripId} onBack={jest.fn()} startWithRescue backLabel="Back to my trips" loadRoom={async () => room} loadAction={async () => ({ revision: 0, data: mockData })} saveAction={saveAction} />);
  expect(await screen.findByText('What happened?')).toBeTruthy();
  expect(screen.getByText('Back to my trips')).toBeTruthy();
  expect(saveAction).not.toHaveBeenCalled();
});
