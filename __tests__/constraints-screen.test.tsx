import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';

import type { ConstraintCollection } from '../packages/contracts/src/constraints';
import { ConstraintsScreen } from '@/features/constraints/constraints-screen';

const mockUseEffect = useEffect;
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void | (() => void)) => mockUseEffect(effect, []) }));

const tripId = '67e3c78c-a1e0-41c2-9f1c-582ed656d777';
const memberId = '11111111-1111-4111-8111-111111111111';
const collection: ConstraintCollection = {
  tripId, tripName: 'Anywhere together', mode: 'undecided', currentMemberId: memberId,
  currentRole: 'organizer', lockedAt: null, canLock: false, ownConstraint: null,
  members: [
    { memberId, displayName: 'Organiser', discriminator: 1, complete: false },
    { memberId: '22222222-2222-4222-8222-222222222222', displayName: 'Aina', discriminator: 1, complete: false },
  ],
};
const subscription = jest.fn(async () => async () => undefined);

describe('ConstraintsScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows required essentials for undecided mode and validates before submit', async () => {
    const saveAction = jest.fn();
    const screen = await render(<ConstraintsScreen tripId={tripId} onBack={jest.fn()} loadAction={jest.fn(async () => collection)} saveAction={saveAction} lockAction={jest.fn()} subscribeAction={subscription} />);
    await waitFor(() => screen.getByText('Anywhere together'));
    expect(screen.getByText('Origin *')).toBeTruthy();
    expect(screen.getByText('Climate')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('save-constraints'));
    expect(await screen.findByText(/Origin is required/)).toBeTruthy();
    expect(saveAction).not.toHaveBeenCalled();
  });

  it('permits an empty submission outside undecided mode', async () => {
    const lockedMode = { ...collection, mode: 'destination_locked' as const };
    const saveAction = jest.fn(async () => ({ ...lockedMode, ownConstraint: null }));
    const screen = await render(<ConstraintsScreen tripId={tripId} onBack={jest.fn()} loadAction={jest.fn(async () => lockedMode)} saveAction={saveAction} lockAction={jest.fn()} subscribeAction={subscription} />);
    await waitFor(() => screen.getByText('Anywhere together'));
    expect(screen.getByText('Origin')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('save-constraints'));
    await waitFor(() => expect(saveAction).toHaveBeenCalled());
  });

  it('is read-only once collection is locked', async () => {
    const locked = { ...collection, lockedAt: '2026-09-01T02:00:00.000Z' };
    const screen = await render(<ConstraintsScreen tripId={tripId} onBack={jest.fn()} loadAction={jest.fn(async () => locked)} saveAction={jest.fn()} lockAction={jest.fn()} subscribeAction={subscription} />);
    await waitFor(() => screen.getByText('Collection locked'));
    expect(screen.queryByTestId('save-constraints')).toBeNull();
    expect(screen.queryByTestId('lock-constraints')).toBeNull();
  });
});
