import { compareConstraints, decideVote, voteProgress } from '@/domain/vote-state';

const options = [
  { optionId: 'penang', name: 'Penang', country: 'Malaysia', constraintScore: 8 },
  { optionId: 'danang', name: 'Da Nang', country: 'Vietnam', constraintScore: 6 },
];

it('counts one ballot per member into a consistent winner', () => {
  expect(decideVote(options, [{ memberId: 'a', optionId: 'penang' }, { memberId: 'b', optionId: 'penang' }, { memberId: 'c', optionId: 'danang' }])).toEqual({
    totals: [{ optionId: 'penang', total: 2 }, { optionId: 'danang', total: 1 }], winningOptionId: 'penang', tiedOptionIds: [],
  });
});

it('preserves a tie instead of selecting randomly', () => {
  const decision = decideVote(options, [{ memberId: 'a', optionId: 'penang' }, { memberId: 'b', optionId: 'danang' }]);
  expect(decision.winningOptionId).toBeNull();
  expect(decision.tiedOptionIds).toEqual(['penang', 'danang']);
});

it('uses explicit constraint scores and leaves equal scores tied', () => {
  expect(compareConstraints(options).winningOptionId).toBe('penang');
  expect(compareConstraints(options.map((option) => ({ ...option, constraintScore: 10 }))).stillTiedOptionIds).toEqual(['danang', 'penang']);
});

it('derives cross-client progress from server counts', () => expect(voteProgress({ participantCount: 4, votedCount: 3 })).toEqual({ remaining: 1, complete: false }));
