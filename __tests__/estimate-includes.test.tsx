import { fireEvent, render } from '@testing-library/react-native';
import { EstimateIncludes } from '../src/features/quest/budget-recommendation';

it('navigates estimate details with bounded controls and offers the complete list', async () => {
  const screen = await render(<EstimateIncludes assumptions={['Stay estimate', 'Food estimate', 'Travel estimate']} />);
  expect(screen.getByLabelText('Previous estimate detail').props.accessibilityState.disabled).toBe(true);
  expect(screen.queryByText('Food estimate')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Next estimate detail'));
  expect(screen.getByText('Food estimate')).toBeTruthy();
  expect(screen.getByText('2 of 3 details')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Next estimate detail'));
  expect(screen.getByLabelText('Next estimate detail').props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(screen.getByLabelText('Previous estimate detail'));
  await fireEvent.press(screen.getByText('View all'));
  for (const text of ['Stay estimate', 'Food estimate', 'Travel estimate']) expect(screen.getByText(text)).toBeTruthy();
  await fireEvent.press(screen.getByText('View cards'));
  expect(screen.getByText('Food estimate')).toBeTruthy();
  expect(screen.queryByText('Stay estimate')).toBeNull();
});

it('omits unnecessary controls for a single detail', async () => {
  const screen = await render(<EstimateIncludes assumptions={['Stay estimate']} />);
  expect(screen.getByText('Stay estimate')).toBeTruthy();
  expect(screen.queryByLabelText('Next estimate detail')).toBeNull();
  expect(screen.queryByText('View all')).toBeNull();
});
