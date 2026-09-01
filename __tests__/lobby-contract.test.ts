import { LobbySchema, memberLabel } from '../packages/contracts/src/lobby';

const member = { memberId: '11111111-1111-4111-8111-111111111111', displayName: 'Aina', discriminator: 2, role: 'member' as const, ready: false, joinedAt: '2026-09-01T00:00:00.000Z' };

describe('Lobby contract', () => {
  it('parses a privacy-safe lobby and labels duplicate names', () => {
    const parsed = LobbySchema.parse({ tripId: '67e3c78c-a1e0-41c2-9f1c-582ed656d777', tripName: 'Langkawi weekend', mode: 'destination_locked', startedAt: null, joiningOpen: true, currentMemberId: member.memberId, currentRole: 'member', members: [member] });
    expect(memberLabel(parsed.members[0])).toBe('Aina · 2');
    expect(parsed.members[0]).not.toHaveProperty('userId');
  });

  it('rejects rooms beyond the eight-member MVP limit', () => {
    const result = LobbySchema.safeParse({ tripId: '67e3c78c-a1e0-41c2-9f1c-582ed656d777', tripName: 'Trip', mode: 'undecided', startedAt: null, joiningOpen: false, currentMemberId: member.memberId, currentRole: 'member', members: Array.from({ length: 9 }, (_, index) => ({ ...member, memberId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}` })) });
    expect(result.success).toBe(false);
  });
});
