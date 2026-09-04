import { z } from 'zod';

export const GroupMatchPayloadSchema = z.object({ tripId: z.uuid() }).strict();

export const expectedGroupMatchRoundKinds = ['vibe', 'pace', 'must_have'] as const;

export function areGroupMatchRoundsComplete(rounds: readonly { sequence: number; kind: string; closed_at: string | null }[]) {
  return rounds.length === expectedGroupMatchRoundKinds.length && rounds.every((round, index) =>
    round.sequence === index + 1 && round.kind === expectedGroupMatchRoundKinds[index] && Boolean(round.closed_at)
  );
}
