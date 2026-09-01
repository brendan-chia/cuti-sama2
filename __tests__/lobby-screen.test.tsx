import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useEffect } from 'react';

import type { Lobby } from '../packages/contracts/src/lobby';
import { LobbyScreen } from '@/features/lobby/lobby-screen';

const mockUseEffect = useEffect;
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void | (() => void)) => mockUseEffect(effect, [effect]) }));

const organizerId = '11111111-1111-4111-8111-111111111111';
const memberId = '22222222-2222-4222-8222-222222222222';
const lobby: Lobby = {
  tripId: '67e3c78c-a1e0-41c2-9f1c-582ed656d777', tripName: 'Langkawi weekend', mode: 'destination_locked', startedAt: null, joiningOpen: true, currentMemberId: organizerId, currentRole: 'organizer',
  members: [
    { memberId: organizerId, displayName: 'Organiser', discriminator: 1, role: 'organizer', ready: true, joinedAt: '2026-09-01T00:00:00.000Z' },
    { memberId, displayName: 'Aina', discriminator: 1, role: 'member', ready: false, joinedAt: '2026-09-01T00:01:00.000Z' },
  ],
};

const subscription = jest.fn(async (_lobby, callbacks) => {
  callbacks.onConnection(true); callbacks.onOnlineMembers(new Set([organizerId, memberId]));
  return async () => undefined;
});

describe('LobbyScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the roster and a specific disabled-start explanation', async () => {
    const screen = await render(<LobbyScreen tripId={lobby.tripId} onInvite={jest.fn()} onAccessRevoked={jest.fn()} loadAction={jest.fn(async () => lobby)} readyAction={jest.fn()} removeAction={jest.fn()} startAction={jest.fn()} closeAction={jest.fn()} subscribeAction={subscription} />);
    await waitFor(() => expect(screen.getByText('Langkawi weekend')).toBeTruthy());
    expect(screen.getAllByText('Aina')).toHaveLength(2);
    expect(screen.getByText(/disabled because 1 active member/)).toBeTruthy();
    expect(screen.getByTestId('start-planning').props.accessibilityState.disabled).toBe(true);
  });

  it('starts only after every active member is ready', async () => {
    const readyLobby = { ...lobby, members: lobby.members.map((member) => ({ ...member, ready: true })) };
    const startAction = jest.fn(async () => ({ ...readyLobby, startedAt: '2026-09-01T01:00:00.000Z' }));
    const screen = await render(<LobbyScreen tripId={lobby.tripId} onInvite={jest.fn()} onAccessRevoked={jest.fn()} loadAction={jest.fn(async () => readyLobby)} readyAction={jest.fn()} removeAction={jest.fn()} startAction={startAction} closeAction={jest.fn()} subscribeAction={subscription} />);
    await waitFor(() => screen.getByText('The table is ready.'));
    await fireEvent.press(screen.getByText('Start planning'));
    await waitFor(() => expect(startAction).toHaveBeenCalledWith(lobby.tripId));
    expect(screen.getByText('Planning has begun')).toBeTruthy();
  });

  it('requires confirmation before removing a member', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    const removeAction = jest.fn(async () => ({ ...lobby, members: [lobby.members[0]] }));
    const screen = await render(<LobbyScreen tripId={lobby.tripId} onInvite={jest.fn()} onAccessRevoked={jest.fn()} loadAction={jest.fn(async () => lobby)} readyAction={jest.fn()} removeAction={removeAction} startAction={jest.fn()} closeAction={jest.fn()} subscribeAction={subscription} />);
    await waitFor(() => expect(screen.getAllByText('Aina')).toHaveLength(2));
    await fireEvent.press(screen.getByText('Remove'));
    const actions = alert.mock.calls[0][2];
    await act(async () => {
      actions?.find((action) => action.text === 'Remove')?.onPress?.();
    });
    await waitFor(() => expect(removeAction).toHaveBeenCalledWith(lobby.tripId, memberId));
  });
});
