import { fireEvent, render, within } from '@testing-library/react-native';
import { BudgetStage } from '@/features/quest/budget-stage';
import { QuestRoomSchema, type QuestRoom } from '../packages/contracts/src/quest';

const member = { memberId: '11111111-1111-4111-8111-111111111111', displayName: 'Sarah', availabilitySubmitted: true, picksSubmitted: false, votesSubmitted: false, budgetSubmitted: true };
const room: QuestRoom = {
  tripId: '22222222-2222-4222-8222-222222222222', tripName: 'Budget trip', currentMemberId: member.memberId,
  currentRole: 'organizer', stage: 'budget', revision: 1, members: [member],
  ownAvailability: null, sharedAvailability: null, period: null, ownPicks: [], countries: [], ownVotes: {}, results: [], tiedCountryCodes: [], selectedCountryCode: null, attractionIds: [],
  ownBudget: { comfortableBudgetMYR: 2400, maxBudgetMYR: 3600 },
  budgetSummary: { submittedCount: 1, crewComfortCeiling: 2400, crewHardCeiling: 3600, currency: 'MYR' },
};

it('shows both crew zones without named strain or individual inputs in the group panel', async () => {
  const view = await render(<BudgetStage room={room} busy={false} act={jest.fn()} />);
  const shared = within(view.getByTestId('crew-budget-zones'));
  expect(shared.getByText('Up to RM 2,400/person')).toBeTruthy();
  expect(shared.getByText('RM 2,400 – RM 3,600/person')).toBeTruthy();
  expect(shared.queryByText(/Sarah/)).toBeNull();
  expect(shared.queryByLabelText('Comfortable spending (RM)')).toBeNull();
  expect(view.getByText('Your exact numbers stay private.')).toBeTruthy();
});

it('keeps invalid pairs unsaved and blocks actions while unavailable', async () => {
  const act = jest.fn();
  const view = await render(<BudgetStage room={room} busy={false} act={act} />);
  await fireEvent.changeText(view.getByLabelText('Absolute maximum (RM)'), '2000');
  expect(view.getByText('Your absolute maximum must be at least your comfortable spending.')).toBeTruthy();
  expect(view.getByTestId('finish-trip-quest').props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(view.getByTestId('submit-quest-budget'));
  expect(act).not.toHaveBeenCalled();
  await view.rerender(<BudgetStage room={room} busy act={act} />);
  expect(view.getByLabelText('Comfortable spending (RM)').props.editable).toBe(false);
  expect(view.getByTestId('finish-trip-quest').props.accessibilityState.disabled).toBe(true);
});

it('never reveals even a supplied aggregate while another active traveller is pending', async () => {
  const pendingRoom = { ...room, members: [...room.members, { ...member, memberId: '33333333-3333-4333-8333-333333333333', budgetSubmitted: false }] };
  const view = await render(<BudgetStage room={pendingRoom} busy={false} act={jest.fn()} />);
  expect(view.queryByTestId('crew-budget-zones')).toBeNull();
  expect(view.getByTestId('finish-trip-quest').props.accessibilityState.disabled).toBe(true);
});

it('rejects accidental private fields in shared member and summary contracts', () => {
  expect(QuestRoomSchema.safeParse(room).success).toBe(true);
  expect(QuestRoomSchema.safeParse({ ...room, members: [{ ...member, comfortableBudgetMYR: 2400 }] }).success).toBe(false);
  expect(QuestRoomSchema.safeParse({ ...room, budgetSummary: { ...room.budgetSummary, lowestMemberId: member.memberId } }).success).toBe(false);
});
