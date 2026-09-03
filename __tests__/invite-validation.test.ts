import { extractInviteToken } from '@/features/invites/validation';
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
