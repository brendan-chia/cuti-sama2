import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { JoinTripScreen } from '@/features/invites/join-trip-screen';

const token = 'A'.repeat(43);
const context = { tripName: 'Langkawi weekend', mode: 'destination_locked' as const, organizerName: 'Organiser', expiresAt: '2026-10-01T00:00:00.000Z' };

describe('JoinTripScreen', () => {
  it('shows only safe invitation context before joining', async () => {
    const screen = await render(<JoinTripScreen token={token} onJoined={jest.fn()} resolveAction={jest.fn(async () => context)} joinAction={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Langkawi weekend')).toBeTruthy());
    expect(screen.getByText(/Organiser invited you/)).toBeTruthy();
    expect(screen.queryByText(/ROOM ID/)).toBeNull();
  });

  it('requires confirmation for a duplicate display name, then joins', async () => {
    const joinAction = jest.fn()
      .mockResolvedValueOnce({ status: 'confirmation_required', displayName: 'Aina', discriminator: 2 })
      .mockResolvedValueOnce({ status: 'joined', tripId: '67e3c78c-a1e0-41c2-9f1c-582ed656d777', memberId: 'e37cb808-7314-44ff-bc72-cb89d3e130ff', tripName: 'Langkawi weekend', displayName: 'Aina', discriminator: 2 });
    const onJoined = jest.fn();
    const screen = await render(<JoinTripScreen token={token} onJoined={onJoined} resolveAction={jest.fn(async () => context)} joinAction={joinAction} />);
    await waitFor(() => screen.getByLabelText('Your display name'));
    await fireEvent.changeText(screen.getByLabelText('Your display name'), 'Aina');
    await fireEvent.press(screen.getByTestId('join-trip-submit'));
    await waitFor(() => expect(screen.getByText('Another Aina is already here')).toBeTruthy());
    await fireEvent.press(screen.getByText('Continue as Aina · 2'));
    await waitFor(() => expect(onJoined).toHaveBeenCalledWith('67e3c78c-a1e0-41c2-9f1c-582ed656d777'));
    expect(joinAction).toHaveBeenNthCalledWith(1, token, 'Aina', false);
    expect(joinAction).toHaveBeenNthCalledWith(2, token, 'Aina', true);
  });

  it('uses a generic unavailable state for an invalid link', async () => {
    const screen = await render(<JoinTripScreen token={token} onJoined={jest.fn()} resolveAction={jest.fn(async () => { throw new Error('database detail'); })} joinAction={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Link unavailable')).toBeTruthy());
    expect(screen.getByText(/This invitation is unavailable/)).toBeTruthy();
    expect(screen.queryByText('database detail')).toBeNull();
  });
});
