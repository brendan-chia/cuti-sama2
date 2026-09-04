import { areGroupMatchRoundsComplete } from '../supabase/functions/group-match/contract';

const closedRounds = [
  { sequence: 1, kind: 'vibe', closed_at: '2026-09-01T00:01:00Z' },
  { sequence: 2, kind: 'pace', closed_at: '2026-09-01T00:02:00Z' },
  { sequence: 3, kind: 'must_have', closed_at: '2026-09-01T00:03:00Z' },
];

describe('group match readiness', () => {
  it('is ready after the three configured preference rounds are closed', () => {
    expect(areGroupMatchRoundsComplete(closedRounds)).toBe(true);
  });

  it('is not ready when a required round is open or missing', () => {
    expect(areGroupMatchRoundsComplete(closedRounds.map((round, index) => index === 2 ? { ...round, closed_at: null } : round))).toBe(false);
    expect(areGroupMatchRoundsComplete(closedRounds.slice(0, 2))).toBe(false);
  });
});
