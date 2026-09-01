import type { PreferenceRound } from '../packages/contracts/src/preferences';
import { canMemberSubmit, deriveRoundState, nextRoundKind, snapshotActiveMemberIds } from '@/domain/round-state';

const participants: PreferenceRound['participants'] = [
  { memberId: '11111111-1111-4111-8111-111111111111', displayName: 'One', discriminator: 1, submitted: true, removed: false },
  { memberId: '22222222-2222-4222-8222-222222222222', displayName: 'Two', discriminator: 1, submitted: false, removed: false },
  { memberId: '33333333-3333-4333-8333-333333333333', displayName: 'Three', discriminator: 1, submitted: false, removed: true },
];

describe('round state', () => {
  it('snapshots only members active when a round opens', () => {
    expect(snapshotActiveMemberIds([{ memberId: 'one', active: true }, { memberId: 'two', active: false }, { memberId: 'three', active: true }])).toEqual(['one', 'three']);
  });

  it('does not let removed snapshot members block completion', () => {
    expect(deriveRoundState({ participants, revealedAt: null, closedAt: null })).toMatchObject({ submittedCount: 1, allSubmitted: false, activeMemberIds: [participants[0].memberId, participants[1].memberId] });
    const complete = participants.map((participant) => participant.removed ? participant : { ...participant, submitted: true });
    expect(deriveRoundState({ participants: complete, revealedAt: null, closedAt: null }).allSubmitted).toBe(true);
  });

  it('prevents submission after reveal or removal', () => {
    expect(canMemberSubmit({ participants, revealedAt: null, closedAt: null }, participants[0].memberId)).toBe(true);
    expect(canMemberSubmit({ participants, revealedAt: '2026-09-01T00:00:00Z', closedAt: null }, participants[0].memberId)).toBe(false);
    expect(canMemberSubmit({ participants, revealedAt: null, closedAt: null }, participants[2].memberId)).toBe(false);
  });

  it('advances through all five round kinds', () => {
    expect(nextRoundKind(null)).toBe('vibe');
    expect(nextRoundKind('vibe')).toBe('pace');
    expect(nextRoundKind('pace')).toBe('must_have');
    expect(nextRoundKind('must_have')).toBe('nice_to_have');
    expect(nextRoundKind('nice_to_have')).toBe('avoid');
    expect(nextRoundKind('avoid')).toBeNull();
  });
});

