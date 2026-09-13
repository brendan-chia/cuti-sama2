import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ItineraryDays } from '@/components/itinerary-days';

test('shows every day in a list without display mode or paging controls', async () => {
  const screen = await render(<ItineraryDays>{[<Text key="1">First stop</Text>, <Text key="2">Second stop</Text>]}</ItineraryDays>);
  expect(screen.getByTestId('itinerary-list')).toBeTruthy();
  expect(screen.getByText('First stop')).toBeTruthy();
  expect(screen.getByText('Second stop')).toBeTruthy();
  expect(screen.queryByText('Card view')).toBeNull();
  expect(screen.queryByText('List view')).toBeNull();
  expect(screen.queryByText('Next day')).toBeNull();
  expect(screen.queryByText('Previous day')).toBeNull();
  expect(screen.queryByTestId('itinerary-day-cards')).toBeNull();
});
