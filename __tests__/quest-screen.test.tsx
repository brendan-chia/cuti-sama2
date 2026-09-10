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
  it('solo planning hides voting and submits one directly selected destination', async () => {
    const { screen, updateAction } = await openQuest(roomWith({ travelParty: 'solo', members: [baseRoom.members[0]] }));
    expect(screen.queryByText('Vote')).toBeNull();
    expect(screen.getByTestId('flight-path').props.accessibilityLabel).toContain('of 5 stages');
    await fireEvent.press(screen.getByLabelText('Japan'));
    await fireEvent.press(screen.getByLabelText('Thailand'));
    await fireEvent.press(screen.getByText('Choose destination & explore'));
    expect(updateAction).toHaveBeenCalledWith(tripId, { type: 'picks', countryCodes: ['TH'] });
  });

  it('solo stays are confirmed directly without a ballot', async () => {
    const stay = { id: '33333333-3333-4333-8333-333333333333', name: 'Solo Hotel', area: 'Tokyo', image: 'https://example.com/stay.jpg', latitude: 35, longitude: 139, totalCost: 1050, checkIn: '2027-12-04', checkOut: '2027-12-08', rating: 8.4, distance: '6 min from station', bookingLink: 'https://example.com/book', provider: 'Provider' };
    const { screen, updateAction } = await openQuest(roomWith({ travelParty: 'solo', stage: 'logistics', members: [baseRoom.members[0]], logistics: { stays: [stay], transport: [], votes: [], selectedStayId: null, skippedMemberIds: [], staySkipped: false } }));
    await fireEvent.press(screen.getByText('Next: Accommodation'));
    expect(screen.queryByText('Vote · 0')).toBeNull();
    await fireEvent.press(screen.getByText('Confirm stay'));
    expect(updateAction).toHaveBeenCalledWith(tripId, { type: 'confirm_stay', stayId: stay.id });
  });

  it.each(['organizer', 'member'] as const)('shows transport and stay inputs on an old completed trip for the %s', async (role) => {
    const room = roomWith({ stage: 'complete', currentRole: role, currentMemberId: role === 'member' ? memberId : organizerId });
    const { screen, updateAction } = await openQuest(room);
    expect(screen.queryByText('QUEST COMPLETE')).toBeNull();
    expect(screen.getByText('CHAPTER 6 · LOGISTICS')).toBeTruthy();
    expect(screen.getByText('Add or edit my own booking')).toBeTruthy();
    expect(screen.queryByLabelText('Departure city / airport')).toBeNull();
    await fireEvent.press(screen.getByText('Add or edit my own booking'));
    expect(screen.getByLabelText('Departure city / airport')).toBeTruthy();
    expect(screen.getByText('Save my transport')).toBeTruthy();
    expect(screen.queryByText('Edit logistics')).toBeNull();
    expect(updateAction).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Next: Accommodation'));
    expect(screen.getByText('Suggested stays')).toBeTruthy();
    await fireEvent.press(screen.getByText('Add my own accommodation'));
    expect(screen.getByLabelText('Hotel / stay name')).toBeTruthy();
    expect(screen.getByLabelText('Total stay price (MYR)')).toBeTruthy();
    expect(screen.getByText('Add stay option')).toBeTruthy();
  });

  it('lets the organiser save another traveller’s transport directly from an old completed trip', async () => {
    const { screen, updateAction } = await openQuest(roomWith({ stage: 'complete' }));
    await fireEvent.press(screen.getByLabelText('Transport for Aina'));
    await fireEvent.press(screen.getByText('Add or edit my own booking'));
    for (const [label, value] of [
      ['Departure city / airport', 'KUL'], ['Destination city / airport', 'NRT'],
      ['Departure date', '2027-12-04'], ['Departure local time', '07:00'], ['Departure UTC offset', '+08:00'],
      ['Arrival date', '2027-12-04'], ['Arrival local time', '14:30'], ['Arrival UTC offset', '+09:00'],
      ['Estimated transport price (MYR)', '850'],
    ]) await fireEvent.changeText(screen.getByLabelText(label), value);
    expect(screen.getByText('● selected')).toBeTruthy();
    await fireEvent.press(screen.getByText('Save Aina’s transport'));
    expect(updateAction).toHaveBeenCalledWith(tripId, { type: 'transport', memberId, transport: {
      direction: 'arrival', mode: 'flight', departureLocation: 'KUL', arrivalLocation: 'NRT',
      departureAt: '2027-12-04T07:00:00+08:00', arrivalAt: '2027-12-04T14:30:00+09:00',
      cost: 850, bookingLink: null, status: 'selected',
    } });
  });

  it('requires summary review before skipping and sends the reviewed revision', async () => {
    const room = roomWith({ stage: 'logistics', selectedCountryCode: 'JP', budgetSummary: { submittedCount: 2, comfortablePerPerson: 3000, currency: 'MYR' } });
    const onItinerary = jest.fn();
    const updateAction = jest.fn(async () => ({ ...room, stage: 'complete' as const, revision: 2 }));
    const { screen } = await openQuest(room, { updateAction, onItinerary });
    await fireEvent.press(screen.getByText('Skip for now'));
    expect(updateAction).not.toHaveBeenCalled();
    expect(screen.getByText(/Schedule may change once transport/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Confirm & Generate Draft Itinerary'));
    expect(updateAction).toHaveBeenCalledWith(tripId, { type: 'complete_logistics', skip: true, revision: 1 });
    expect(onItinerary).toHaveBeenCalledTimes(1);
  });

  it('lets members vote on stays but hides organiser confirmation controls', async () => {
    const stay = { id: '33333333-3333-4333-8333-333333333333', name: 'Crew Hotel', area: 'Tokyo', image: 'https://example.com/stay.jpg', latitude: 35, longitude: 139, totalCost: 1050, checkIn: '2027-12-04', checkOut: '2027-12-08', rating: 8.4, distance: '6 min from station', bookingLink: 'https://example.com/book', provider: 'Provider' };
    const room = roomWith({ stage: 'logistics', currentRole: 'member', currentMemberId: memberId, logistics: { stays: [stay], transport: [], votes: [], selectedStayId: null, skippedMemberIds: [], staySkipped: false } });
    const { screen, updateAction } = await openQuest(room);
    await fireEvent.press(screen.getByText('○ Accommodation'));
    expect(screen.getByText('RM 1,050 total · RM 525/person')).toBeTruthy();
    expect(screen.queryByText('Confirm stay')).toBeNull();
    await fireEvent.press(screen.getByText('Vote · 0'));
    expect(updateAction).toHaveBeenCalledWith(tripId, { type: 'stay_vote', stayId: stay.id });
    await fireEvent.press(screen.getByText('Review logistics summary'));
    expect(screen.queryByText('Confirm & Generate Draft Itinerary')).toBeNull();
  });

  it('collects a proposal and hides the compiled list until everyone submits', async () => {
    const room = roomWith({ stage: 'timing', period: null, ownAvailability: null, members: baseRoom.members.map((member) => ({ ...member, availabilitySubmitted: member.memberId === organizerId })) });
    const { screen, updateAction } = await openQuest(room);
    expect(screen.queryByTestId('suggest-trip-periods')).toBeNull();
    expect(screen.queryByTestId('date-proposals')).toBeNull();
    expect(screen.getByText(/1 of 2 proposals received/)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Proposed start date'), '2027-12-04');
    await fireEvent.changeText(screen.getByLabelText('Proposed end date'), '2027-12-08');
    await fireEvent.press(screen.getByTestId('save-quest-availability'));
    expect(updateAction).toHaveBeenCalledWith(tripId, { type: 'availability', startsOn: '2027-12-04', endsOn: '2027-12-08', preferences: { flexibility: '7', daysOff: [0, 6], unavailable: [] } });
  });

  it('generates one persisted recommendation and confirms its dates', async () => {
    const room = roomWith({ stage: 'timing', period: null, ownAvailability: { startsOn: '2027-12-04', endsOn: '2027-12-08' }, sharedAvailability: null,
      dateProposals: [{ memberId: organizerId, startsOn: '2027-12-04', endsOn: '2027-12-08' }, { memberId, startsOn: '2027-12-10', endsOn: '2027-12-14' }] });
    const suggested = { startsOn: '2027-12-07', endsOn: '2027-12-11', label: '5 days together', reason: 'Fits the crew preferences.' };
    const suggestAction = jest.fn(async (): Promise<QuestRoom> => ({ ...room, revision: 2, dateRecommendation: {
      periods: [{ ...suggested, durationDays: 5, holidays: [], travellers: [{ memberId, leaveDays: 4, leaveDates: ['2027-12-07', '2027-12-08', '2027-12-09', '2027-12-10'], shiftDays: -3, durationChange: 0 }] }],
      source: 'groq', message: 'Shared dates for your crew.', calendarVersion: 'test', calendarNotice: 'Nationwide holidays only.',
    } }));
    const updateAction = jest.fn(async () => roomWith({ revision: 3 }));
    const { screen } = await openQuest(room, { updateAction, suggestAction });
    expect(screen.queryByTestId(`choose-proposal-${memberId}`)).toBeNull();
    await fireEvent.press(screen.getByTestId('suggest-trip-periods'));
    await waitFor(() => expect(screen.getByText('Recommended for your crew')).toBeTruthy());
    expect(suggestAction).toHaveBeenCalledWith(tripId);
    expect(screen.getByText('Annual leave to request')).toBeTruthy();
    expect(screen.getAllByText('Aina').length).toBeGreaterThan(0);
    expect(screen.getByText('4 days')).toBeTruthy();
    await fireEvent.press(screen.getByText('View leave dates & details'));
    for (const date of ['2027-12-07', '2027-12-08', '2027-12-09', '2027-12-10']) {
      expect(screen.getByText(new Date(`${date}T12:00:00`).toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }), { exact: false })).toBeTruthy();
    }
    await fireEvent.press(screen.getByTestId('confirm-recommendation-0'));
    expect(updateAction).toHaveBeenCalledWith(tripId, { type: 'period', period: suggested });
    await waitFor(() => expect(screen.getByLabelText('Find a country')).toBeTruthy());
  });

  it('requires saving unavailable dates before recommending a period', async () => {
    const room = roomWith({ stage: 'timing', period: null, ownAvailability: { startsOn: '2027-12-04', endsOn: '2027-12-08' } });
    const { screen, updateAction } = await openQuest(room);
    await fireEvent.changeText(screen.getByLabelText('Unavailable from'), '2027-12-10');
    await fireEvent.changeText(screen.getByLabelText('Unavailable until'), '2027-12-12');
    expect(screen.getByTestId('suggest-trip-periods').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByText('Add unavailable dates'));
    await fireEvent.press(screen.getByTestId('save-quest-availability'));
    expect(updateAction).toHaveBeenCalledWith(tripId, expect.objectContaining({ preferences: expect.objectContaining({ unavailable: [{ startsOn: '2027-12-10', endsOn: '2027-12-12' }] }) }));
  });

  it('enables recommendations after saving semantically identical preferences in a different order', async () => {
    const room = roomWith({ stage: 'timing', period: null, ownAvailability: { startsOn: '2027-12-04', endsOn: '2027-12-08' } });
    const saved = { ...room, revision: 2, ownDatePreferences: { unavailable: [], daysOff: [6, 0], flexibility: '7' as const } };
    const { screen } = await openQuest(room, { updateAction: jest.fn(async () => saved) });
    await fireEvent.press(screen.getByTestId('save-quest-availability'));
    await waitFor(() => expect(screen.getByTestId('suggest-trip-periods').props.accessibilityState.disabled).toBe(false));
    expect(screen.queryByText('Save your changes before finding or confirming shared dates.')).toBeNull();
  });

  it('refreshes an untouched form when saved dates arrive from another device', async () => {
    const room = roomWith({ stage: 'timing', period: null, ownAvailability: { startsOn: '2027-12-04', endsOn: '2027-12-08' } });
    const updated = { ...room, revision: 2, ownAvailability: { startsOn: '2027-12-10', endsOn: '2027-12-14' } };
    const loadAction = jest.fn().mockResolvedValueOnce(room).mockResolvedValue(updated);
    const { screen, notify } = await openQuest(room, { loadAction });
    await act(async () => notify());
    await waitFor(() => expect(screen.getByLabelText('Proposed start date').props.value).toBe('2027-12-10'));
    expect(screen.getByTestId('suggest-trip-periods').props.accessibilityState.disabled).toBe(false);
  });

  it('preserves actual unsaved edits during a saved-proposal refresh', async () => {
    const room = roomWith({ stage: 'timing', period: null, ownAvailability: { startsOn: '2027-12-04', endsOn: '2027-12-08' } });
    const updated = { ...room, revision: 2, ownAvailability: { startsOn: '2027-12-10', endsOn: '2027-12-14' } };
    const loadAction = jest.fn().mockResolvedValueOnce(room).mockResolvedValue(updated);
    const { screen, notify } = await openQuest(room, { loadAction });
    await fireEvent.changeText(screen.getByLabelText('Proposed start date'), '2027-12-06');
    await act(async () => notify());
    await waitFor(() => expect(screen.getByText(/Your saved proposal:.*10 Dec 2027/)).toBeTruthy());
    expect(screen.getByLabelText('Proposed start date').props.value).toBe('2027-12-06');
    expect(screen.getByTestId('suggest-trip-periods').props.accessibilityState.disabled).toBe(true);
  });

  it('caps wishlists at three countries and waits for the server to open voting', async () => {
    const saved = roomWith({ revision: 2, ownPicks: ['JP', 'TH', 'KH'], members: baseRoom.members.map((member) => ({ ...member, picksSubmitted: member.memberId === organizerId })) });
    const updateAction = jest.fn(async () => saved);
    const { screen } = await openQuest(roomWith(), { updateAction });
    expect(screen.queryByLabelText('Italy')).toBeNull();
    for (const country of ['Japan', 'Thailand', 'Cambodia']) await fireEvent.press(screen.getByLabelText(country));
    expect(screen.getByLabelText('Malaysia').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByLabelText('Malaysia'));
    expect(screen.getByLabelText('3 of 3 country slots filled')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('submit-country-picks'));
    expect(updateAction).toHaveBeenCalledWith(tripId, { type: 'picks', countryCodes: ['JP', 'TH', 'KH'] });
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

  it('lets members choose attractions and exposes vote submission', async () => {
    const country = countryByCode('JP')!;
    const room = roomWith({ stage: 'explore', selectedCountryCode: 'JP', currentRole: 'member', currentMemberId: memberId, attractionIds: [country.attractions[0].id] });
    const updateAction = jest.fn(async () => ({ ...room, attractionVotes: [{ memberId, attractionIds: [country.attractions[0].id] }] }));
    const { screen } = await openQuest(room, { updateAction });
    expect(screen.getByTestId('attraction-map')).toBeTruthy();
    const marker = screen.getByLabelText(`Select ${country.attractions[0].name}`);
    expect(marker.props.accessibilityState).toEqual({ disabled: false, checked: false });
    await fireEvent.press(marker);
    expect(screen.getByTestId('save-quest-attractions')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('save-quest-attractions'));
    expect(updateAction).toHaveBeenCalledWith(tripId, { type: 'attraction_votes', attractionIds: [country.attractions[0].id] });
    expect(screen.queryByTestId('compile-quest-attractions')).toBeNull();
  });

  it('compiles submitted votes only after everyone has voted', async () => {
    const room = roomWith({ stage: 'explore', selectedCountryCode: 'JP', attractionVotes: [
      { memberId: organizerId, attractionIds: ['jp-senso-ji'] },
      { memberId, attractionIds: ['jp-fushimi-inari'] },
    ] });
    const updateAction = jest.fn(async () => ({ ...room, stage: 'budget' as const }));
    const { screen } = await openQuest(room, { updateAction });
    await fireEvent.press(screen.getByTestId('compile-quest-attractions'));
    expect(updateAction).toHaveBeenCalledWith(tripId, { type: 'compile_attractions' });
  });

  it('disables compilation while another traveller has not voted', async () => {
    const room = roomWith({ stage: 'explore', selectedCountryCode: 'JP', attractionVotes: [{ memberId: organizerId, attractionIds: ['jp-senso-ji'] }] });
    const { screen } = await openQuest(room);
    expect(screen.getByTestId('compile-quest-attractions').props.accessibilityState.disabled).toBe(true);
  });

  it('waits for every budget and shows the lowest shared ceiling before completion', async () => {
    const room = roomWith({ stage: 'budget', selectedCountryCode: 'JP' });
    const saved = { ...room, revision: 2, ownBudget: 2500, members: room.members.map((member) => ({ ...member, budgetSubmitted: member.memberId === organizerId })), budgetSummary: { submittedCount: 1, comfortablePerPerson: 2500, currency: 'MYR' as const } };
    const allReady = { ...saved, revision: 3, members: saved.members.map((member) => ({ ...member, budgetSubmitted: true })), budgetSummary: { submittedCount: 2, comfortablePerPerson: 1500, currency: 'MYR' as const } };
    const loadAction = jest.fn().mockResolvedValueOnce(room).mockResolvedValue(allReady);
    const updateAction = jest.fn().mockResolvedValueOnce(saved).mockResolvedValueOnce({ ...allReady, revision: 4, stage: 'logistics' });
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
    await waitFor(() => expect(screen.getByText('CHAPTER 6 · LOGISTICS')).toBeTruthy());
  });

  it('summarizes the saved destination, dates, stops and per-person ceiling', async () => {
    const country = countryByCode('JP')!;
    const stay = { id: '33333333-3333-4333-8333-333333333333', name: 'Crew stay', area: 'Tokyo', image: 'https://example.com/stay.jpg', latitude: 35, longitude: 139, totalCost: 1000, checkIn: '2027-12-04', checkOut: '2027-12-08', rating: 8, distance: '6 min from station', bookingLink: 'https://example.com/book', provider: 'Provider' };
    const transport = baseRoom.members.flatMap((member) => (['arrival', 'departure'] as const).map((direction) => ({ memberId: member.memberId, direction, mode: 'flight' as const, status: 'selected' as const, departureLocation: 'KUL', arrivalLocation: 'NRT', departureAt: '2027-12-04T07:00:00+08:00', arrivalAt: '2027-12-04T14:30:00+09:00', cost: 100, bookingLink: null })));
    const room = roomWith({ stage: 'complete', logistics: { transport, stays: [stay], selectedStayId: stay.id, votes: [], skippedMemberIds: [], staySkipped: false }, selectedCountryCode: 'JP', attractionIds: country.attractions.slice(0, 2).map((place) => place.id), budgetSummary: { submittedCount: 2, comfortablePerPerson: 1500, currency: 'MYR' } });
    const onItinerary = jest.fn();
    const { screen } = await openQuest(room, { onItinerary });
    expect(screen.getByLabelText('6 of 6 stages completed. Journey complete')).toBeTruthy();
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
    await fireEvent.press(screen.getByText('View original proposals'));
    expect(screen.getByTestId('date-proposals')).toBeTruthy();
    expect(screen.queryByTestId(`choose-proposal-${organizerId}`)).toBeNull();
    await act(async () => notify());
    await waitFor(() => expect(screen.getAllByText(/10 Feb 2028.*15 Feb 2028/)).toHaveLength(2));
    expect(screen.queryByText(/10 Jan 2028.*15 Jan 2028/)).toBeNull();
  });
});

 it('solo dates confirm directly without shared preferences or recommendations', async () => {
  const { screen, updateAction } = await openQuest(roomWith({ travelParty: 'solo', stage: 'timing', period: null, members: [baseRoom.members[0]] }));
  expect(screen.queryByText('Find our best dates')).toBeNull();
  expect(screen.queryByText('Add unavailable dates')).toBeNull();
  expect(screen.queryByLabelText('Unavailable from')).toBeNull();
  expect(screen.queryByLabelText('Unavailable until')).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('Start date'), '2027-12-04');
  await fireEvent.changeText(screen.getByLabelText('End date'), '2027-12-08');
  await fireEvent.press(screen.getByText('Confirm my dates'));
  expect(updateAction).toHaveBeenCalledWith(tripId, { type: 'availability', startsOn: '2027-12-04', endsOn: '2027-12-08', preferences: { flexibility: 'exact', daysOff: [], unavailable: [] } });
 });
 it('solo budget uses personal wording and saves a limit', async () => {
  const { screen, updateAction } = await openQuest(roomWith({ travelParty: 'solo', stage: 'budget', members: [baseRoom.members[0]] }));
  expect(screen.queryByText('Play my budget card')).toBeNull();
  expect(screen.queryByText(/group’s spending ceiling/)).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('My trip budget (MYR)'), '3000');
  await fireEvent.press(screen.getByText('Save my budget'));
  expect(updateAction).toHaveBeenCalledWith(tripId, { type: 'budget', amount: 3000 });
 });

it.each(['organizer', 'member'] as const)('announces the decided destination to the %s when voting becomes explore', async currentRole => {
  const start = { ...votingRoom(), currentRole };
  const decided = { ...start, stage: 'explore' as const, selectedCountryCode: 'JP', revision: 2 };
  const loadAction = jest.fn().mockResolvedValueOnce(start).mockResolvedValue(decided);
  const { screen, notify } = await openQuest(start, { loadAction });
  expect(screen.queryByTestId('destination-announcement')).toBeNull();
  await act(async () => notify());
  await waitFor(() => expect(screen.getByTestId('destination-announcement')).toBeTruthy());
  expect(screen.getByText('You’re going to Japan.')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('dismiss-destination-announcement'));
  expect(screen.queryByTestId('destination-announcement')).toBeNull();
  await act(async () => notify());
  expect(screen.queryByTestId('destination-announcement')).toBeNull();
});
