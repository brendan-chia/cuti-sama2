import { extractInviteToken, invitationUrlForOrigin, invitationBrowserUrl } from '@/features/invites/validation';
import { IssuedInvitationSchema } from '../packages/contracts/src/invite';

const token = 'A'.repeat(43);

describe('extractInviteToken', () => {
  it('accepts a raw opaque token', () => expect(extractInviteToken(token)).toBe(token));
  it('extracts a token from an HTTPS invitation URL', () => expect(extractInviteToken(`https://cutisama.example/invite/${token}`)).toBe(token));
  it('rejects malformed and incomplete invitations', () => {
    expect(extractInviteToken('not-an-invite')).toBeNull();
    expect(extractInviteToken('https://cutisama.example/invite/short')).toBeNull();
  });
});

describe('invitation response validation', () => {
  it('accepts PostgreSQL timestamps with an explicit UTC offset', () => {
    expect(IssuedInvitationSchema.safeParse({
      status: 'open',
      inviteId: '67e3c78c-a1e0-41c2-9f1c-582ed656d777',
      token: 'A'.repeat(43),
      inviteUrl: `https://cutisama.example/invite/${'A'.repeat(43)}`,
      expiresAt: '2026-10-03T06:58:12.123456+00:00',
    }).success).toBe(true);
  });
});

describe('invitation URL host selection', () => {
  const invitation = {
    status: 'open' as const,
    inviteId: '67e3c78c-a1e0-41c2-9f1c-582ed656d777',
    token,
    inviteUrl: `https://cutisama.example/invite/${token}`,
    expiresAt: '2026-10-03T06:58:12.123Z',
  };

  it('uses the current web origin for LAN participant links', () => {
    expect(invitationUrlForOrigin(invitation, 'http://10.249.42.33:8081')).toBe(`http://10.249.42.33:8081/invite/${token}`);
  });

  it('keeps the canonical URL when no web origin is available', () => {
    expect(invitationUrlForOrigin(invitation, null)).toBe(invitation.inviteUrl);
  });
});

test('accepts Expo Go and installed-app invitation links', () => {
  expect(extractInviteToken('exp://192.168.1.20:8081/--/invite/' + token)).toBe(token);
  expect(extractInviteToken('cutisama2://invite/' + token)).toBe(token);
  expect(extractInviteToken('cutisama2:///invite/' + token)).toBe(token);
});

test('provides browser invitations for LAN and tunnel demos', () => {
  const invitation = { token, inviteUrl: 'https://example.com/invite/' + token } as Parameters<typeof invitationBrowserUrl>[0];
  expect(invitationBrowserUrl(invitation, 'exp://192.168.1.20:8081/--/invite/' + token)).toBe('http://192.168.1.20:8081/invite/' + token);
  expect(invitationBrowserUrl(invitation, 'exp://demo.exp.direct/--/invite/' + token)).toBe('https://demo.exp.direct/invite/' + token);
  expect(invitationBrowserUrl(invitation, 'exps://demo.example/--/invite/' + token)).toBe('https://demo.example/invite/' + token);
  expect(invitationBrowserUrl(invitation, 'cutisama2://invite/' + token)).toBeNull();
});
