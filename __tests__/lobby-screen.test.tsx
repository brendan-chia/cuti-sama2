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
  it('waits for pending subscription setup and removal before subscribing again', async () => {
    let finishSetup!: (cleanup: () => Promise<void>) => void;
    let finishRemoval!: () => void;
    const removal = new Promise<void>((resolve) => { finishRemoval = resolve; });
    const cleanup = jest.fn(() => removal);
    const subscribeAction = jest.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { finishSetup = resolve; }))
      .mockResolvedValue(async () => undefined);
    const props = { tripId: lobby.tripId, onInvite: jest.fn(), onAccessRevoked: jest.fn(), loadAction: jest.fn(async () => lobby), subscribeAction };
    const screen = await render(<LobbyScreen {...props} />);
    await waitFor(() => expect(subscribeAction).toHaveBeenCalledTimes(1));
    await screen.rerender(<LobbyScreen {...props} onAccessRevoked={jest.fn()} />);
    expect(subscribeAction).toHaveBeenCalledTimes(1);
    await act(async () => { finishSetup(cleanup); });
    await waitFor(() => expect(cleanup).toHaveBeenCalledTimes(1));
    expect(subscribeAction).toHaveBeenCalledTimes(1);
    await act(async () => { finishRemoval(); });
    await waitFor(() => expect(subscribeAction).toHaveBeenCalledTimes(2));
  });

  it('shows subscription failures without an unhandled rejection', async () => {
    const screen = await render(<LobbyScreen tripId={lobby.tripId} onInvite={jest.fn()} onAccessRevoked={jest.fn()} loadAction={jest.fn(async () => lobby)} subscribeAction={jest.fn().mockRejectedValue(new Error('Realtime unavailable'))} />);
    await waitFor(() => expect(screen.getByText('Realtime unavailable')).toBeTruthy());
  });

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

  it('lets the organiser remove a participant after planning has started', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    const startedLobby = { ...lobby, startedAt: '2026-09-01T01:00:00.000Z' };
    const removeAction = jest.fn(async () => ({ ...startedLobby, members: [startedLobby.members[0]] }));
    const screen = await render(<LobbyScreen tripId={lobby.tripId} onInvite={jest.fn()} onAccessRevoked={jest.fn()} loadAction={jest.fn(async () => startedLobby)} readyAction={jest.fn()} removeAction={removeAction} startAction={jest.fn()} closeAction={jest.fn()} subscribeAction={subscription} />);
    await waitFor(() => expect(screen.getByText('Planning has begun')).toBeTruthy());

    await fireEvent.press(screen.getByTestId(`remove-member-${memberId}`));
    const actions = alert.mock.calls[0][2];
    await act(async () => {
      actions?.find((action) => action.text === 'Remove')?.onPress?.();
    });

    await waitFor(() => expect(removeAction).toHaveBeenCalledWith(lobby.tripId, memberId));
    expect(screen.queryByText('Aina')).toBeNull();
  });

  it('does not show removal controls to participants', async () => {
    const memberLobby = { ...lobby, currentMemberId: memberId, currentRole: 'member' as const };
    const screen = await render(<LobbyScreen tripId={lobby.tripId} onInvite={jest.fn()} onAccessRevoked={jest.fn()} loadAction={jest.fn(async () => memberLobby)} readyAction={jest.fn()} removeAction={jest.fn()} startAction={jest.fn()} closeAction={jest.fn()} subscribeAction={subscription} />);
    await waitFor(() => expect(screen.getByText('Langkawi weekend')).toBeTruthy());

    expect(screen.queryByTestId(`remove-member-${memberId}`)).toBeNull();
    expect(screen.queryByText('Remove')).toBeNull();
  });

  it('shows Enter preferences after this member completes locked constraints', async () => {
    const startedLobby: Lobby = {
      ...lobby, startedAt: '2026-09-01T01:00:00.000Z', constraintsLockedAt: '2026-09-01T01:15:00.000Z',
      members: lobby.members.map((member) => ({ ...member, constraintComplete: member.memberId === organizerId })),
    };
    const onPreferences = jest.fn();
    const screen = await render(<LobbyScreen tripId={lobby.tripId} onInvite={jest.fn()} onAccessRevoked={jest.fn()} onConstraints={jest.fn()} onPreferences={onPreferences} loadAction={jest.fn(async () => startedLobby)} readyAction={jest.fn()} removeAction={jest.fn()} startAction={jest.fn()} closeAction={jest.fn()} subscribeAction={subscription} />);
    await waitFor(() => screen.getByTestId('open-preferences')); await fireEvent.press(screen.getByTestId('open-preferences'));
    expect(onPreferences).toHaveBeenCalled(); expect(screen.queryByText('Add my constraints')).toBeNull();
  });

  it.each([false, true])('opens the quest before legacy constraint or preference routes (constraints complete: %s)', async (constraintComplete) => {
    const startedLobby: Lobby = {
      ...lobby, startedAt: '2026-09-01T01:00:00.000Z',
      constraintsLockedAt: constraintComplete ? '2026-09-01T01:15:00.000Z' : null,
      members: lobby.members.map((member) => ({ ...member, constraintComplete })),
    };
    const onQuest = jest.fn(); const onPreferences = jest.fn(); const onConstraints = jest.fn();
    const screen = await render(<LobbyScreen tripId={lobby.tripId} onInvite={jest.fn()} onAccessRevoked={jest.fn()} onQuest={onQuest} onPreferences={onPreferences} onConstraints={onConstraints} loadAction={jest.fn(async () => startedLobby)} readyAction={jest.fn()} removeAction={jest.fn()} startAction={jest.fn()} closeAction={jest.fn()} subscribeAction={subscription} />);
    await waitFor(() => expect(screen.getByTestId('open-trip-quest')).toBeTruthy());
    expect(screen.queryByTestId('open-preferences')).toBeNull();
    expect(screen.queryByTestId('open-constraints')).toBeNull();
    await fireEvent.press(screen.getByTestId('open-trip-quest'));
    expect(onQuest).toHaveBeenCalledTimes(1);
    expect(onPreferences).not.toHaveBeenCalled();
    expect(onConstraints).not.toHaveBeenCalled();
  });
});

test('updates travellers and readiness without a top notification', async () => {
  let changed: () => void = () => undefined;
  let current = lobby;
  const screen = await render(<LobbyScreen tripId={lobby.tripId} onInvite={jest.fn()} onAccessRevoked={jest.fn()} loadAction={async () => current} subscribeAction={async (_room, callbacks) => { changed = callbacks.onChanged; return async () => undefined; }} />);
  await waitFor(() => expect(screen.getByText('Langkawi weekend')).toBeTruthy());
  current = { ...lobby, members: [...lobby.members, { ...lobby.members[1], memberId: '33333333-3333-4333-8333-333333333333', displayName: 'Sam' }] };
  await act(async () => changed());
  await waitFor(() => expect(screen.getAllByText('Sam').length).toBeGreaterThan(0));
  expect(screen.queryByText('Group updates')).toBeNull();
  current = { ...current, members: current.members.map(member => ({ ...member, ready: true })) };
  await act(async () => changed());
  await waitFor(() => expect(screen.getByText('The table is ready.')).toBeTruthy());
  await act(async () => changed());
  expect(screen.queryByText('Group updates')).toBeNull();
  expect(screen.queryByText('Dismiss updates')).toBeNull();
});
