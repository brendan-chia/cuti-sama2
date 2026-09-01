import type { VoteOption, VoteRound } from '../../packages/contracts/src/vote';

export type Ballot = { memberId: string; optionId: string };

export function countVotes(options: Pick<VoteOption, 'optionId'>[], ballots: Ballot[]) {
  const counts = new Map(options.map((option) => [option.optionId, 0]));
  for (const ballot of ballots) if (counts.has(ballot.optionId)) counts.set(ballot.optionId, (counts.get(ballot.optionId) ?? 0) + 1);
  return options.map((option) => ({ optionId: option.optionId, total: counts.get(option.optionId) ?? 0 }));
}

export function decideVote(options: Pick<VoteOption, 'optionId'>[], ballots: Ballot[]) {
  const totals = countVotes(options, ballots);
  const maximum = Math.max(0, ...totals.map((item) => item.total));
  const leaders = maximum === 0 ? [] : totals.filter((item) => item.total === maximum).map((item) => item.optionId);
  return { totals, winningOptionId: leaders.length === 1 ? leaders[0] : null, tiedOptionIds: leaders.length > 1 ? leaders : [] };
}

export function compareConstraints(options: VoteOption[]) {
  const ordered = [...options].sort((a, b) => b.constraintScore - a.constraintScore || a.optionId.localeCompare(b.optionId));
  const bestScore = ordered[0]?.constraintScore;
  const leaders = ordered.filter((option) => option.constraintScore === bestScore);
  return {
    comparison: ordered.map((option) => ({ optionId: option.optionId, score: option.constraintScore })),
    winningOptionId: leaders.length === 1 ? leaders[0].optionId : null,
    stillTiedOptionIds: leaders.length > 1 ? leaders.map((option) => option.optionId) : [],
  };
}

export function canChangeOwnVote(round: Pick<VoteRound, 'status'>) { return round.status === 'open'; }
export function voteProgress(round: Pick<VoteRound, 'participantCount' | 'votedCount'>) {
  return { remaining: Math.max(0, round.participantCount - round.votedCount), complete: round.participantCount > 0 && round.participantCount === round.votedCount };
}
