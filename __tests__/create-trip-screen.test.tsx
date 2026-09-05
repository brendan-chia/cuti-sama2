import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type { TripSummary } from '../packages/contracts/src/trip';
import { CreateTripScreen } from '@/features/trips/create-trip-screen';

const createdTrip: TripSummary = {
  tripId: '67e3c78c-a1e0-41c2-9f1c-582ed656d777',
  memberId: 'e37cb808-7314-44ff-bc72-cb89d3e130ff',
  tripName: 'The annual escape', mode: 'undecided', status: 'draft',
  destinations: [], startsOn: null, endsOn: null,
};

describe('CreateTripScreen', () => {
  it('starts with a trip name and explains the five planning chapters', async () => {
    const screen = await render(<CreateTripScreen configured createTripAction={jest.fn()} onCreated={jest.fn()} />);
    expect(screen.getByLabelText('Trip name')).toBeTruthy();
    expect(screen.queryByLabelText('Destination')).toBeNull();
    expect(screen.queryByLabelText('Destination shortlist')).toBeNull();
    for (const chapter of ['Find your window', 'Play your wishlist', 'Swipe to decide', 'Explore the map', 'Find your comfort zone']) {
      expect(screen.getByText(chapter)).toBeTruthy();
    }
  });

  it('submits a valid normalized request and returns the created room', async () => {
    const action = jest.fn(async () => createdTrip);
    const onCreated = jest.fn();
    const screen = await render(<CreateTripScreen configured createTripAction={action} onCreated={onCreated} />);
    await fireEvent.changeText(screen.getByLabelText('Trip name'), '  The annual escape  ');
    await fireEvent.press(screen.getByTestId('create-trip-submit'));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(createdTrip));
    expect(action).toHaveBeenCalledWith(expect.objectContaining({
      tripName: 'The annual escape', mode: 'undecided', destinations: [], startsOn: null, endsOn: null,
    }));
  });

  it('explains missing required fields without calling the backend', async () => {
    const action = jest.fn();
    const screen = await render(<CreateTripScreen configured createTripAction={action} onCreated={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('create-trip-submit'));
    expect(screen.getByText(/Trip name must have at least 2 characters/i)).toBeTruthy();
    expect(screen.queryByText(/exactly one destination/i)).toBeNull();
    expect(action).not.toHaveBeenCalled();
  });

  it('disables creation and shows setup guidance without configuration', async () => {
    const screen = await render(<CreateTripScreen configured={false} onCreated={jest.fn()} />);
    expect(screen.getByText('Trip rooms are unavailable')).toBeTruthy();
    expect(screen.getByTestId('create-trip-submit').props.accessibilityState.disabled).toBe(true);
  });
});
