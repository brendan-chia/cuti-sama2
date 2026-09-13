import { useState } from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { PlaceChipField } from '@/components/place-chip-field';
function Editor({ editable = true }: { editable?: boolean }) {
  const [value, setValue] = useState('Wat Arun, Bangkok\nKrabi & Railay Beach\n');
  return <PlaceChipField value={value} onChangeText={setValue} editable={editable} />;
}
test('removes one complete place without splitting its comma-separated address', async () => {
  const screen = await render(<Editor />);
  await fireEvent.press(screen.getByLabelText('Remove Wat Arun, Bangkok'));
  expect(screen.queryByText('Wat Arun, Bangkok')).toBeNull(); expect(screen.getByText('Krabi & Railay Beach')).toBeTruthy();
});
test('keeps pending caption text and commits newline-delimited places', async () => {
  const screen = await render(<Editor />);
  await fireEvent.changeText(screen.getByLabelText('Caption or place names'), 'Chiang Rai\nA caption, with commas');
  expect(screen.getByText('Chiang Rai')).toBeTruthy();
  expect(screen.getByLabelText('Caption or place names').props.value).toBe('A caption, with commas');
  await fireEvent.press(screen.getByLabelText('Remove Chiang Rai'));
  expect(screen.getByLabelText('Caption or place names').props.value).toBe('A caption, with commas');
});
test('locked input cannot remove or edit places', async () => {
  const screen = await render(<Editor editable={false} />);
  await fireEvent.press(screen.getByLabelText('Remove Wat Arun, Bangkok'));
  expect(screen.getByText('Wat Arun, Bangkok')).toBeTruthy();
  expect(screen.getByLabelText('Caption or place names').props.editable).toBe(false);
});
