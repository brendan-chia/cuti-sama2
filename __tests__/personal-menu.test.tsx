import { fireEvent, render } from '@testing-library/react-native';
import { PersonalMenu } from '@/components/personal-menu';
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useFocusEffect: jest.fn() }));
jest.mock('@/features/profile/service', () => ({ loadProfile: jest.fn() }));
it.each([
  ['My trips', { pathname: '/profile', params: { section: 'trips' } }],
  ['Travel passport / profile', { pathname: '/profile', params: { section: 'passport' } }],
  ['Saved inspiration', '/inspiration'],
  ['Settings', { pathname: '/profile', params: { section: 'settings' } }],
])('opens %s from the personal menu', async (label, route) => {
  const screen = await render(<PersonalMenu />);
  await fireEvent.press(screen.getByLabelText('Open personal space'));
  await fireEvent.press(screen.getByText(label as string));
  expect(mockPush).toHaveBeenLastCalledWith(route);
  expect(screen.queryByText('Your personal space')).toBeNull();
});
