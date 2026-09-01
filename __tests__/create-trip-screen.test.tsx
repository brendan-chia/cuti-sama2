import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type { TripSummary } from '../packages/contracts/src/trip';
import { CreateTripScreen } from '@/features/trips/create-trip-screen';

const createdTrip: TripSummary = {
  tripId: '67e3c78c-a1e0-41c2-9f1c-582ed656d777',
  memberId: 'e37cb808-7314-44ff-bc72-cb89d3e130ff',
  tripName: 'Langkawi long weekend', mode: 'destination_locked', status: 'draft',
  destinations: ['Langkawi'], startsOn: null, endsOn: null,
};

describe('CreateTripScreen', () => {
  it('shows only fields required by the selected mode', async () => {
    const screen = await render(<CreateTripScreen configured createTripAction={jest.fn()} onCreated={jest.fn()} />);
    expect(screen.getByLabelText('Destination')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Help us decide'));
    expect(screen.queryByLabelText('Destination')).toBeNull();
    expect(screen.getByText('NO DESTINATION NEEDED YET')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('We are choosing between places'));
    expect(screen.getByLabelText('Destination shortlist')).toBeTruthy();
  });

  it('submits a valid normalized request and returns the created room', async () => {
    const action = jest.fn(async () => createdTrip);
    const onCreated = jest.fn();
    const screen = await render(<CreateTripScreen configured createTripAction={action} onCreated={onCreated} />);
    await fireEvent.changeText(screen.getByLabelText('Trip name'), 'Langkawi long weekend');
    await fireEvent.changeText(screen.getByLabelText('Destination'), 'Langkawi');
    await fireEvent.press(screen.getByTestId('create-trip-submit'));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(createdTrip));
    expect(action).toHaveBeenCalledWith(expect.objectContaining({
      tripName: 'Langkawi long weekend', mode: 'destination_locked', destinations: ['Langkawi'],
    }));
  });

  it('explains missing required fields without calling the backend', async () => {
    const action = jest.fn();
    const screen = await render(<CreateTripScreen configured createTripAction={action} onCreated={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('create-trip-submit'));
    expect(screen.getByText(/Trip name must have at least 2 characters/i)).toBeTruthy();
    expect(screen.getByText(/exactly one destination/i)).toBeTruthy();
    expect(action).not.toHaveBeenCalled();
  });

  it('disables creation and shows setup guidance without configuration', async () => {
    const screen = await render(<CreateTripScreen configured={false} onCreated={jest.fn()} />);
    expect(screen.getByText('Connect Supabase to create a room')).toBeTruthy();
    expect(screen.getByTestId('create-trip-submit').props.accessibilityState.disabled).toBe(true);
  });
});
