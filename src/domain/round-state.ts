import { preferenceRoundKinds, type PreferenceRound, type PreferenceRoundKind } from '../../packages/contracts/src/preferences';

export type ActiveMember = { memberId: string; active: boolean };

export function snapshotActiveMemberIds(members: ActiveMember[]) {
  return members.filter((member) => member.active).map((member) => member.memberId);
}

export function nextRoundKind(kind: PreferenceRoundKind | null): PreferenceRoundKind | null {
  if (kind === null) return preferenceRoundKinds[0];
  const index = preferenceRoundKinds.indexOf(kind);
  return index < 0 || index === preferenceRoundKinds.length - 1 ? null : preferenceRoundKinds[index + 1];
}

export function deriveRoundState(round: Pick<PreferenceRound, 'participants' | 'revealedAt' | 'closedAt'>) {
  const active = round.participants.filter((participant) => !participant.removed);
  const submittedCount = active.filter((participant) => participant.submitted).length;
  return {
    activeMemberIds: active.map((participant) => participant.memberId),
    submittedCount,
    allSubmitted: active.length > 0 && submittedCount === active.length,
    status: round.closedAt ? 'closed' as const : round.revealedAt ? 'revealed' as const : 'collecting' as const,
  };
}

export function canMemberSubmit(round: Pick<PreferenceRound, 'participants' | 'revealedAt' | 'closedAt'>, memberId: string) {
  return !round.revealedAt && !round.closedAt && round.participants.some((participant) => participant.memberId === memberId && !participant.removed);
}

