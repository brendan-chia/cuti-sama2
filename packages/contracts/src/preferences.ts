import { z } from 'zod';

export const preferenceRoundKinds = ['vibe', 'pace', 'must_have', 'nice_to_have', 'avoid'] as const;
export const PreferenceRoundKindSchema = z.enum(preferenceRoundKinds);
export type PreferenceRoundKind = z.infer<typeof PreferenceRoundKindSchema>;

export const PreferenceCardDefinitionSchema = z.object({
  kind: PreferenceRoundKindSchema,
  label: z.string().min(1).max(40),
  example: z.string().min(1).max(160),
  accessibleName: z.string().min(1).max(240),
});
export type PreferenceCardDefinition = z.infer<typeof PreferenceCardDefinitionSchema>;

export const SubmitCardPayloadSchema = z.object({
  tripId: z.uuid(),
  roundId: z.uuid(),
  value: z.string().trim().min(1, 'Add a preference before submitting.').max(240),
  idempotencyKey: z.uuid(),
}).strict();
export type SubmitCardPayload = z.infer<typeof SubmitCardPayloadSchema>;

export const ManageRoundPayloadSchema = z.object({
  tripId: z.uuid(),
  action: z.enum(['start', 'close', 'advance']),
  idempotencyKey: z.uuid(),
}).strict();
export type ManageRoundPayload = z.infer<typeof ManageRoundPayloadSchema>;

export const RoundParticipantSchema = z.object({
  memberId: z.uuid(),
  displayName: z.string().min(1).max(50),
  discriminator: z.number().int().positive(),
  submitted: z.boolean(),
  removed: z.boolean(),
});

export const RevealedPreferenceSchema = z.object({
  memberId: z.uuid(),
  displayName: z.string().min(1).max(50),
  discriminator: z.number().int().positive(),
  value: z.string().min(1).max(240),
  updatedAt: z.iso.datetime({ offset: true }),
});

export const PreferenceRoundSchema = z.object({
  roundId: z.uuid(),
  sequence: z.number().int().min(1).max(5),
  kind: PreferenceRoundKindSchema,
  status: z.enum(['collecting', 'revealed', 'closed']),
  createdAt: z.iso.datetime({ offset: true }),
  revealedAt: z.iso.datetime({ offset: true }).nullable(),
  closedAt: z.iso.datetime({ offset: true }).nullable(),
  participantCount: z.number().int().nonnegative(),
  submittedCount: z.number().int().nonnegative(),
  participants: z.array(RoundParticipantSchema).max(8),
  ownSubmission: z.object({ value: z.string().min(1).max(240), updatedAt: z.iso.datetime({ offset: true }) }).nullable(),
  revealedSubmissions: z.array(RevealedPreferenceSchema).max(8),
});
export type PreferenceRound = z.infer<typeof PreferenceRoundSchema>;

export const TripRoomSchema = z.object({
  tripId: z.uuid(),
  tripName: z.string().min(2).max(80),
  currentMemberId: z.uuid(),
  currentRole: z.enum(['organizer', 'member']),
  complete: z.boolean(),
  currentRound: PreferenceRoundSchema.nullable(),
});
export type TripRoom = z.infer<typeof TripRoomSchema>;

