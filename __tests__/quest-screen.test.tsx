import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useEffect, type ComponentProps } from 'react';

import { countryByCode } from '../packages/contracts/src/countries';
import type { QuestRoom, TripPeriod } from '../packages/contracts/src/quest';
import { QuestScreen } from '@/features/quest/quest-screen';

const mockUseEffect = useEffect;
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void | (() => void)) => mockUseEffect(effect, [effect]) }));
jest.mock('@/theme/motion', () => ({ useReducedMotion: () => true }));
jest.mock('@/components/date-field', () => {
  const React = jest.requireActual('react'); const { TextInput } = jest.requireActual('react-native');
  return { DateField: ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => React.createElement(TextInput, { accessibilityLabel: label, value, onChangeText: onChange }) };
});
jest.mock('@/features/quest/attraction-map', () => {
  const React = jest.requireActual('react'); const { Pressable, Text, View } = jest.requireActual('react-native');
  return { AttractionMap: ({ country, selectedIds, onToggle, disabled }: { country: { attractions: { id: string; name: string }[] }; selectedIds: string[]; onToggle: (id: string) => void; disabled: boolean }) => React.createElement(View, { testID: 'attraction-map' },
    ...country.attractions.map((place) => React.createElement(Pressable, {
      key: place.id, accessibilityRole: 'checkbox', accessibilityLabel: `Select ${place.name}`,
      accessibilityState: { disabled, checked: selectedIds.includes(place.id) }, disabled, onPress: () => onToggle(place.id),
    }, React.createElement(Text, null, place.name))),
  ) };
});

const organizerId = '11111111-1111-4111-8111-111111111111';
const memberId = '22222222-2222-4222-8222-222222222222';
const tripId = '67e3c78c-a1e0-41c2-9f1c-582ed656d777';
const period: TripPeriod = { startsOn: '2027-12-04', endsOn: '2027-12-08', label: 'Five days together', reason: 'Fits the shared calendar with two weekend days.' };
const baseRoom: QuestRoom = {
  tripId, tripName: 'The annual escape', currentMemberId: organizerId, currentRole: 'organizer',
  stage: 'picks', revision: 1,
  members: [
    { memberId: organizerId, displayName: 'Organiser', availabilitySubmitted: true, picksSubmitted: false, votesSubmitted: false, budgetSubmitted: false },
    { memberId, displayName: 'Aina', availabilitySubmitted: true, picksSubmitted: false, votesSubmitted: false, budgetSubmitted: false },
  ],
  ownAvailability: { startsOn: '2027-12-01', endsOn: '2027-12-31' },
  sharedAvailability: { startsOn: '2027-12-01', endsOn: '2027-12-31' }, period,
  ownPicks: [], countries: [], ownVotes: {}, results: [], tiedCountryCodes: [], selectedCountryCode: null,
  attractionIds: [], ownBudget: null, budgetSummary: null,
};
const roomWith = (overrides: Partial<QuestRoom> = {}): QuestRoom => ({ ...baseRoom, ...overrides });
const votingRoom = (): QuestRoom => roomWith({ stage: 'voting', countries: ['JP', 'TH'], ownPicks: ['JP'], members: baseRoom.members.map((member) => ({ ...member, picksSubmitted: true })) });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => { resolve = settle; });
  return { promise, resolve };
}

async function openQuest(room: QuestRoom, overrides: Partial<ComponentProps<typeof QuestScreen>> = {}) {
  let notify = () => {};
  const loadAction = overrides.loadAction ?? jest.fn(async () => room);
  const updateAction = overrides.updateAction ?? jest.fn(async () => room);
  const subscribeAction = jest.fn(async (_tripId: string, onChanged: () => void) => {
    notify = onChanged; return async () => undefined;
  });
  const screen = await render(<QuestScreen tripId={tripId} onBack={jest.fn()} loadAction={loadAction} updateAction={updateAction} subscribeAction={subscribeAction} {...overrides} />);
  await waitFor(() => expect(screen.getByTestId('trip-quest-screen')).toBeTruthy());
  return { screen, loadAction, updateAction, notify: () => notify() };
}

describe('trip quest shared planning flow', () => {
  it('collects a proposal and hides the compiled list until everyone submits', async () => {
    const room = roomWith({ stage: 'timing', period: null, ownAvailability: null, members: baseRoom.members.map((member) => ({ ...member, availabilitySubmitted: member.memberId === organizerId })) });
    const { screen, updateAction } = await openQuest(room);
    expect(screen.queryByTestId('suggest-trip-periods')).toBeNull();
    expect(screen.queryByTestId('date-proposals')).toBeNull();
    expect(screen.getByText(/1 of 2 proposals received/)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Proposed start date'), '2027-12-04');
    await fireEvent.changeText(screen.getByLabelText('Proposed end date'), '2027-12-08');
    await fireEvent.press(screen.getByTestId('save-quest-availability'));
    expect(updateAction).toHaveBeenCalledWith(tripId, { type: 'availability', startsOn: '2027-12-04', endsOn: '2027-12-08' });
  });

  it('shows every proposal even without overlap and lets the organiser confirm one', async () => {
    const room = roomWith({ stage: 'timing', period: null, sharedAvailability: null, dateProposals: [
      { memberId: organizerId, startsOn: '2027-12-04', endsOn: '2027-12-08' },
      { memberId, startsOn: '2028-01-10', endsOn: '2028-01-15' },
    ] });
    const updateAction = jest.fn(async () => roomWith({ revision: 2 }));
    const { screen } = await openQuest(room, { updateAction });
    expect(screen.getByText('Organiser (you)')).toBeTruthy();
    expect(screen.getByText(/10 Jan 2028.*15 Jan 2028/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`choose-proposal-${memberId}`));
    expect(updateAction).toHaveBeenCalledWith(tripId, { type: 'period', period: {
      startsOn: '2028-01-10', endsOn: '2028-01-15', label: 'Crew-proposed travel dates', reason: 'Chosen by the organiser from the crew’s proposed dates.',
    } });
    await waitFor(() => expect(screen.getByLabelText('Find a country')).toBeTruthy());
  });

  it('caps wishlists at three countries and waits for the server to open voting', async () => {
    const saved = roomWith({ revision: 2, ownPicks: ['JP', 'TH', 'IT'], members: baseRoom.members.map((member) => ({ ...member, picksSubmitted: member.memberId === organizerId })) });
    const updateAction = jest.fn(async () => saved);
    const { screen } = await openQuest(roomWith(), { updateAction });
    for (const country of ['Japan', 'Thailand', 'Italy']) await fireEvent.press(screen.getByLabelText(country));
    expect(screen.getByLabelText('Malaysia').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByLabelText('Malaysia'));
    expect(screen.getByLabelText('3 of 3 country slots filled')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('submit-country-picks'));
    expect(updateAction).toHaveBeenCalledWith(tripId, { type: 'picks', countryCodes: ['JP', 'TH', 'IT'] });
    await waitFor(() => expect(screen.getByText('Your wishlist is on the table.')).toBeTruthy());
    expect(screen.getByText(/Everyone’s picks stay hidden until the whole group/)).toBeTruthy();
    expect(screen.queryByTestId('country-swipe-card')).toBeNull();
  });

  it.each([true, false])('saves a %s vote and only advances after server acknowledgment', async (agree) => {
    const before = votingRoom(); const pending = deferred<QuestRoom>();
    const updateAction = jest.fn(() => pending.promise);
    const { screen } = await openQuest(before, { updateAction });
    await fireEvent.press(screen.getByLabelText(`${agree ? 'Agree' : 'Disagree'} with Japan`));
    expect(updateAction).toHaveBeenCalledWith(tripId, { type: 'vote', countryCode: 'JP', agree });
    expect(screen.getByLabelText('Agree with Japan')).toBeTruthy();
    expect(screen.queryByLabelText('Agree with Thailand')).toBeNull();
    await act(async () => pending.resolve({ ...before, revision: 2, ownVotes: { JP: agree } }));
    await waitFor(() => expect(screen.getByLabelText('Agree with Thailand')).toBeTruthy());
    expect(screen.getByLabelText('Review vote for Japan')).toBeTruthy();
  });

  it('keeps a failed vote on the current card and displays the save error', async () => {
    const updateAction = jest.fn(async () => { throw new Error('Your vote was not saved. Try again.'); });
    const { screen } = await openQuest(votingRoom(), { updateAction });
    await fireEvent.press(screen.getByLabelText('Agree with Japan'));
    await waitFor(() => expect(screen.getByText('Your vote was not saved. Try again.')).toBeTruthy());
    expect(screen.getByLabelText('Agree with Japan')).toBeTruthy();
    expect(screen.queryByLabelText('Agree with Thailand')).toBeNull();
    expect(screen.queryByLabelText('Review vote for Japan')).toBeNull();
  });

  it('waits for the rest of the crew after a member completes the deck', async () => {
    const room = { ...votingRoom(), ownVotes: { JP: true, TH: false }, members: baseRoom.members.map((member) => ({ ...member, picksSubmitted: true, votesSubmitted: member.memberId === organizerId })) };
    const { screen } = await openQuest(room);
    expect(screen.getByText('You’ve played your hand.')).toBeTruthy();
    expect(screen.getByText(/The winner is revealed once everyone has voted/)).toBeTruthy();
    expect(screen.queryByText('DESTINATION UNLOCKED')).toBeNull();
  });

  it('lets the organizer resolve only tied favourites', async () => {
    const room: QuestRoom = { ...votingRoom(), results: [{ countryCode: 'JP', agreeCount: 1 }, { countryCode: 'TH', agreeCount: 1 }], tiedCountryCodes: ['JP', 'TH'] };
    const updateAction = jest.fn(async (): Promise<QuestRoom> => ({ ...room, revision: 2, stage: 'explore', selectedCountryCode: 'JP' }));
    const { screen } = await openQuest(room, { updateAction });
    expect(screen.getByText('A photo finish.')).toBeTruthy();
    expect(screen.queryByText('Choose Italy')).toBeNull();
    await fireEvent.press(screen.getByText('Choose Japan'));
    expect(updateAction).toHaveBeenCalledWith(tripId, { type: 'resolve_tie', countryCode: 'JP' });
    await waitFor(() => expect(screen.getByText('DESTINATION UNLOCKED')).toBeTruthy());
  });

  it('offers a fresh wishlist round when every country receives zero yes votes', async () => {
    const room: QuestRoom = { ...votingRoom(), results: [{ countryCode: 'JP', agreeCount: 0 }, { countryCode: 'TH', agreeCount: 0 }] };
    const updateAction = jest.fn(async () => roomWith({ revision: 2 }));
    const { screen } = await openQuest(room, { updateAction });
    expect(screen.getByText('The group wants a fresh deck.')).toBeTruthy();
    expect(screen.queryByText('Choose Japan')).toBeNull();
    await fireEvent.press(screen.getByText('Open a fresh wishlist round'));
    expect(updateAction).toHaveBeenCalledWith(tripId, { type: 'restart_picks' });
    await waitFor(() => expect(screen.getByLabelText('Find a country')).toBeTruthy());
  });

  it('lets members inspect the destination map while keeping stop selection with the organizer', async () => {
    const country = countryByCode('JP')!;
    const room = roomWith({ stage: 'explore', selectedCountryCode: 'JP', currentRole: 'member', currentMemberId: memberId, attractionIds: [country.attractions[0].id] });
    const updateAction = jest.fn();
    const { screen } = await openQuest(room, { updateAction });
    expect(screen.getByTestId('attraction-map')).toBeTruthy();
    const marker = screen.getByLabelText(`Select ${country.attractions[0].name}`);
    expect(marker.props.accessibilityState).toEqual({ disabled: true, checked: true });
    await fireEvent.press(marker);
    expect(screen.queryByTestId('save-quest-attractions')).toBeNull();
    expect(updateAction).not.toHaveBeenCalled();
  });

  it('waits for every budget and shows the lowest shared ceiling before completion', async () => {
    const room = roomWith({ stage: 'budget', selectedCountryCode: 'JP' });
    const saved = { ...room, revision: 2, ownBudget: 2500, members: room.members.map((member) => ({ ...member, budgetSubmitted: member.memberId === organizerId })), budgetSummary: { submittedCount: 1, comfortablePerPerson: 2500, currency: 'MYR' as const } };
    const allReady = { ...saved, revision: 3, members: saved.members.map((member) => ({ ...member, budgetSubmitted: true })), budgetSummary: { submittedCount: 2, comfortablePerPerson: 1500, currency: 'MYR' as const } };
    const loadAction = jest.fn().mockResolvedValueOnce(room).mockResolvedValue(allReady);
    const updateAction = jest.fn().mockResolvedValueOnce(saved).mockResolvedValueOnce({ ...allReady, revision: 4, stage: 'complete' });
    const { screen, notify } = await openQuest(room, { loadAction, updateAction });
    await fireEvent.changeText(screen.getByLabelText('My maximum per person (MYR)'), '2500');
    await fireEvent.press(screen.getByTestId('submit-quest-budget'));
    expect(updateAction).toHaveBeenCalledWith(tripId, { type: 'budget', amount: 2500 });
    await waitFor(() => expect(screen.getByText('Your saved limit: RM 2,500')).toBeTruthy());
    expect(screen.getByTestId('finish-trip-quest').props.accessibilityState.disabled).toBe(true);
    expect(screen.queryByText('EVERYONE’S COMFORT ZONE')).toBeNull();
    await act(async () => notify());
    await waitFor(() => expect(screen.getByText('RM 1,500')).toBeTruthy());
    expect(screen.getByTestId('finish-trip-quest').props.accessibilityState.disabled).toBe(false);
    await fireEvent.press(screen.getByTestId('finish-trip-quest'));
    expect(updateAction).toHaveBeenLastCalledWith(tripId, { type: 'finish' });
    await waitFor(() => expect(screen.getByText('QUEST COMPLETE')).toBeTruthy());
  });

  it('summarizes the saved destination, dates, stops and per-person ceiling', async () => {
    const country = countryByCode('JP')!;
    const room = roomWith({ stage: 'complete', selectedCountryCode: 'JP', attractionIds: country.attractions.slice(0, 2).map((place) => place.id), budgetSummary: { submittedCount: 2, comfortablePerPerson: 1500, currency: 'MYR' } });
    const onItinerary = jest.fn();
    const { screen } = await openQuest(room, { onItinerary });
    expect(screen.getByLabelText('5 of 5 stages completed. Journey complete')).toBeTruthy();
    expect(screen.getByText('From group chat to game plan.')).toBeTruthy();
    expect(screen.getByText(/4 Dec 2027.*8 Dec 2027/)).toBeTruthy();
    expect(screen.getByText(new RegExp(`01\\s+${country.attractions[0].name}`))).toBeTruthy();
    expect(screen.getByText(new RegExp(`02\\s+${country.attractions[1].name}`))).toBeTruthy();
    expect(screen.getByText('RM 1,500')).toBeTruthy();
    expect(screen.getByText('per person · 2 travellers · whole trip')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('open-quest-itinerary'));
    expect(onItinerary).toHaveBeenCalledTimes(1);
  });

  it('ignores an older delayed room response after a newer stage arrives', async () => {
    const initial = roomWith({ revision: 4 }); const delayed = deferred<QuestRoom>();
    const newer = { ...votingRoom(), revision: 6 };
    const loadAction = jest.fn().mockResolvedValueOnce(initial).mockReturnValueOnce(delayed.promise).mockResolvedValueOnce(newer);
    const { screen, notify } = await openQuest(initial, { loadAction });
    await act(async () => notify());
    await act(async () => notify());
    await waitFor(() => expect(screen.getByLabelText('Agree with Japan')).toBeTruthy());
    await act(async () => delayed.resolve(roomWith({ revision: 5 })));
    expect(screen.getByLabelText('Agree with Japan')).toBeTruthy();
    expect(screen.queryByLabelText('Find a country')).toBeNull();
  });

  it('shares revised proposals with members without exposing organiser controls', async () => {
    const room = roomWith({ stage: 'timing', period: null, currentRole: 'member', currentMemberId: memberId, dateProposals: [{ memberId: organizerId, startsOn: '2027-12-04', endsOn: '2027-12-08' }, { memberId, startsOn: '2028-01-10', endsOn: '2028-01-15' }] });
    const loadAction = jest.fn().mockResolvedValueOnce(room).mockResolvedValue({ ...room, revision: 2, dateProposals: room.dateProposals?.map((proposal) => ({ ...proposal, startsOn: '2028-02-10', endsOn: '2028-02-15' })) });
    const { screen, notify } = await openQuest(room, { loadAction });
    expect(screen.getByTestId('date-proposals')).toBeTruthy();
    expect(screen.queryByTestId(`choose-proposal-${organizerId}`)).toBeNull();
    await act(async () => notify());
    await waitFor(() => expect(screen.getAllByText(/10 Feb 2028.*15 Feb 2028/)).toHaveLength(2));
    expect(screen.queryByText(/10 Jan 2028.*15 Jan 2028/)).toBeNull();
  });
});
