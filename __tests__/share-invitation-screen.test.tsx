import * as Clipboard from 'expo-clipboard';
import { fireEvent, render } from '@testing-library/react-native';
import { ShareInvitationScreen } from '@/features/invites/share-invitation-screen';
import type { IssuedInvitation } from '../packages/contracts/src/invite';
const invitation: IssuedInvitation = { status: 'open', inviteId: '11111111-1111-4111-8111-111111111111', token: 'a'.repeat(43), inviteUrl: 'https://example.com/join/' + 'a'.repeat(43), expiresAt: '2027-09-19T00:00:00Z' };
const tripId = '22222222-2222-4222-8222-222222222222';
test('opens directly into sharing details for a first invitation', async () => {
  const issueAction = jest.fn(async () => invitation);
  const screen = await render(<ShareInvitationScreen tripId={tripId} loadAction={async () => ({ status: { status: 'never_issued' }, invitation: null })} issueAction={issueAction} />);
  expect(await screen.findByText('Share invitation')).toBeTruthy();
  expect(issueAction).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('No invitation link yet')).toBeNull();
  expect(screen.queryByText('Create invitation link')).toBeNull();
});
test('reuses existing invitation details without issuing another link', async () => {
  const issueAction = jest.fn();
  const screen = await render(<ShareInvitationScreen tripId={tripId} loadAction={async () => ({ status: invitation, invitation })} issueAction={issueAction} />);
  expect(await screen.findByText('Copy link')).toBeTruthy();
  expect(issueAction).not.toHaveBeenCalled();
});
test('offers retry if automatic preparation fails', async () => {
  const issueAction = jest.fn().mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce(invitation);
  const screen = await render(<ShareInvitationScreen tripId={tripId} loadAction={async () => ({ status: { status: 'never_issued' }, invitation: null })} issueAction={issueAction} />);
  await screen.findByText('Connection lost');
  await fireEvent.press(screen.getByText('Try again'));
  expect(await screen.findByText('Share invitation')).toBeTruthy();
});

jest.mock('expo-linking', () => ({
  createURL: (path: string) => 'exp://192.168.1.20:8081/--/' + path,
}));

test('copies the running demo browser address for a laptop participant', async () => {
  const copy = jest.spyOn(Clipboard, 'setStringAsync').mockResolvedValue(true);
  const screen = await render(<ShareInvitationScreen tripId={tripId} loadAction={async () => ({ status: invitation, invitation })} />);
  await fireEvent.press(await screen.findByText('Copy browser link'));
  expect(copy).toHaveBeenCalledWith('http://192.168.1.20:8081/invite/' + invitation.token);
  await fireEvent.press(screen.getByText('Copy link'));
  expect(copy).toHaveBeenCalledWith('exp://192.168.1.20:8081/--/invite/' + invitation.token);
  copy.mockRestore();
});
