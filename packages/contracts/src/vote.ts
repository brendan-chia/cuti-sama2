import { z } from 'zod';

export const VoteRoleSchema = z.enum(['organizer', 'member']);
export const VoteRoundStatusSchema = z.enum(['open', 'closed', 'tied']);
export const VoteResolutionSchema = z.enum(['majority', 'constraint_comparison']).nullable();

export const VoteOptionSchema = z.object({
  optionId: z.string().min(1).max(200),
  name: z.string().min(1).max(120),
  country: z.string().min(1).max(120).nullable(),
  constraintScore: z.number().int(),
}).strict();
export type VoteOption = z.infer<typeof VoteOptionSchema>;

export const VoteTotalSchema = z.object({
  optionId: z.string().min(1).max(200),
  total: z.number().int().nonnegative(),
}).strict();

export const ConstraintComparisonSchema = z.object({
  optionId: z.string().min(1).max(200),
  score: z.number().int(),
}).strict();

export const VoteRoundSchema = z.object({
  roundId: z.uuid(),
  roundNumber: z.number().int().positive(),
  status: VoteRoundStatusSchema,
  options: z.array(VoteOptionSchema).min(1).max(5),
  participantCount: z.number().int().positive(),
  votedCount: z.number().int().nonnegative(),
  ownVoteOptionId: z.string().min(1).max(200).nullable(),
  totals: z.array(VoteTotalSchema).nullable(),
  tiedOptionIds: z.array(z.string().min(1).max(200)).max(5),
  winningOptionId: z.string().min(1).max(200).nullable(),
  resolution: VoteResolutionSchema,
  constraintComparison: z.array(ConstraintComparisonSchema).nullable(),
  closedAt: z.iso.datetime({ offset: true }).nullable(),
}).strict().superRefine((round, context) => {
  if (round.status === 'open' && round.totals !== null) context.addIssue({ code: 'custom', path: ['totals'], message: 'Open vote totals must remain hidden.' });
  if (round.status !== 'open' && round.totals === null) context.addIssue({ code: 'custom', path: ['totals'], message: 'Closed vote totals are required.' });
  if (round.status === 'tied' && round.tiedOptionIds.length < 2) context.addIssue({ code: 'custom', path: ['tiedOptionIds'], message: 'A tie requires at least two options.' });
});
export type VoteRound = z.infer<typeof VoteRoundSchema>;

export const LockedDestinationSchema = z.object({
  optionId: z.string().min(1).max(200),
  name: z.string().min(1).max(120),
  country: z.string().min(1).max(120).nullable(),
  lockedAt: z.iso.datetime({ offset: true }),
}).strict();

export const VoteRoomSchema = z.object({
  tripId: z.uuid(),
  tripName: z.string().min(2).max(80),
  currentMemberId: z.uuid(),
  currentRole: VoteRoleSchema,
  phase: z.enum(['destination_voting', 'itinerary_planning']),
  round: VoteRoundSchema.nullable(),
  lockedDestination: LockedDestinationSchema.nullable(),
}).strict();
export type VoteRoom = z.infer<typeof VoteRoomSchema>;

export const VoteRoomRequestSchema = z.object({ tripId: z.uuid() }).strict();
export const SubmitVotePayloadSchema = z.object({ tripId: z.uuid(), roundId: z.uuid(), optionId: z.string().min(1).max(200), idempotencyKey: z.uuid() }).strict();
export const CloseVotePayloadSchema = z.object({ tripId: z.uuid(), action: z.enum(['start', 'close', 'second_vote', 'constraint_comparison']), idempotencyKey: z.uuid() }).strict();
export const LockDestinationPayloadSchema = z.object({ tripId: z.uuid(), optionId: z.string().min(1).max(200), action: z.enum(['lock', 'unlock']), idempotencyKey: z.uuid() }).strict();

export type SubmitVotePayload = z.infer<typeof SubmitVotePayloadSchema>;
export type CloseVotePayload = z.infer<typeof CloseVotePayloadSchema>;
export type LockDestinationPayload = z.infer<typeof LockDestinationPayloadSchema>;
