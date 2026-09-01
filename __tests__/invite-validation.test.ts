import { extractInviteToken } from '@/features/invites/validation';

const token = 'A'.repeat(43);

describe('extractInviteToken', () => {
  it('accepts a raw opaque token', () => expect(extractInviteToken(token)).toBe(token));
  it('extracts a token from an HTTPS invitation URL', () => expect(extractInviteToken(`https://cutisama.example/invite/${token}`)).toBe(token));
  it('rejects malformed and incomplete invitations', () => {
    expect(extractInviteToken('not-an-invite')).toBeNull();
    expect(extractInviteToken('https://cutisama.example/invite/short')).toBeNull();
  });
});
