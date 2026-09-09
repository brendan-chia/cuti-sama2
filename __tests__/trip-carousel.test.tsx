import { fireEvent, render } from '@testing-library/react-native';
import { TripCarousel } from '@/features/profile/trip-carousel';
const trips = [
  { id: 'solo', name: 'Graduation Trip', travel_party: 'solo', ends_on: null, planning_started_at: null },
  { id: 'group', name: 'KL', travel_party: 'group', ends_on: null, planning_started_at: null },
];
test('navigation keeps trip actions associated with the visible card', async () => {
  const onOpen = jest.fn(); const onComplete = jest.fn(); const onManage = jest.fn();
  const screen = await render(<TripCarousel trips={trips} completed={new Set()} busy={false} onOpen={onOpen} onComplete={onComplete} onManage={onManage} />);
  await fireEvent.press(screen.getByText('Open trip'));
  expect(onOpen).toHaveBeenCalledWith('solo');
  expect(screen.queryByText('Manage public listing')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Next trip'));
  expect(screen.getByText('2 of 2 · Swipe to explore')).toBeTruthy();
  await fireEvent.press(screen.getByText('Record as completed'));
  expect(onComplete).toHaveBeenCalledWith('group');
  await fireEvent.press(screen.getByText('Manage public listing'));
  expect(onManage).toHaveBeenCalledWith('group');
});
test('completed trips hide completion action and single cards hide navigation', async () => {
  const screen = await render(<TripCarousel trips={[trips[0]]} completed={new Set(['solo'])} busy={false} onOpen={jest.fn()} onComplete={jest.fn()} onManage={jest.fn()} />);
  expect(screen.getByText('Solo adventure · Completed')).toBeTruthy();
  expect(screen.queryByText('Record as completed')).toBeNull();
  expect(screen.queryByLabelText('Next trip')).toBeNull();
});
