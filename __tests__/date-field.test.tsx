import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import { DateField } from '@/components/date-field';

beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date(2026, 8, 8, 12)); });
afterEach(async () => { await cleanup(); jest.useRealTimers(); });

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

test('every calendar blocks past dates even when an older minimum was supplied', async () => {
  const onChange = jest.fn();
  const screen = await render(<DateField label="Date" value="2025-01-01" minimumDate="2025-01-01" onChange={onChange} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Date' }));
  expect(screen.getByText('September 2026')).toBeTruthy();
  expect(screen.getByRole('button', { name: '7 September 2026' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '8 September 2026' })).not.toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: '7 September 2026' }));
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Previous month for Date' })).toBeDisabled();
});

test('an open calendar updates its minimum when midnight passes', async () => {
  jest.setSystemTime(new Date(2026, 8, 8, 23, 59, 59));
  const onChange = jest.fn();
  const screen = await render(<DateField label="Date" value="" onChange={onChange} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Date' }));
  expect(screen.getByRole('button', { name: '8 September 2026' })).not.toBeDisabled();
  await act(async () => { jest.advanceTimersByTime(1001); });
  expect(screen.getByRole('button', { name: '8 September 2026' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '9 September 2026' })).not.toBeDisabled();
});
