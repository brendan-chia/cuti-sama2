import { fireEvent, render } from '@testing-library/react-native';
import { DateField } from '@/components/date-field';

test('selects a leap day from the calendar without typing', async () => {
  const onChange = jest.fn();
  const screen = await render(<DateField label="Trip start" value="2028-02-01" onChange={onChange} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Trip start' }));
  await fireEvent.press(screen.getByRole('button', { name: '29 February 2028' }));
  expect(onChange).toHaveBeenCalledWith('2028-02-29');
  expect(screen.queryByTestId('trip-start-picker')).toBeNull();
});
test('blocks days before the minimum and navigates across years', async () => {
  const onChange = jest.fn();
  const screen = await render(<DateField label="Trip end" value="" minimumDate="2027-12-20" onChange={onChange} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Trip end' }));
  expect(screen.getByRole('button', { name: '19 December 2027' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Previous month for Trip end' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Next month for Trip end' }));
  await fireEvent.press(screen.getByRole('button', { name: '1 January 2028' }));
  expect(onChange).toHaveBeenCalledWith('2028-01-01');
});
test('closing the calendar does not modify the date; clear is explicit', async () => {
  const onChange = jest.fn();
  const screen = await render(<DateField label="Check-in" value="2027-10-12" onChange={onChange} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Check-in' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Check-in' }));
  expect(onChange).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Clear Check-in' }));
  expect(onChange).toHaveBeenCalledWith('');
});
