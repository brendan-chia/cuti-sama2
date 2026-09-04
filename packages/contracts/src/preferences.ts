import { z } from 'zod';

export const preferenceRoundKinds = ['vibe', 'pace', 'must_have'] as const;
export const PreferenceRoundKindSchema = z.enum(preferenceRoundKinds);
export type PreferenceRoundKind = z.infer<typeof PreferenceRoundKindSchema>;

export const PreferenceChoiceSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]{2,40}$/), roundType: PreferenceRoundKindSchema,
  title: z.string().min(1).max(40), description: z.string().min(1).max(160),
  illustration: z.string().min(1).max(40), accentColor: z.string().min(1).max(20),
  accessibilityLabel: z.string().min(1).max(240), accessibilityHint: z.string().min(1).max(240),
  itineraryTags: z.array(z.string().min(1).max(40)).max(8), paceValue: z.number().int().min(0).max(4).nullable(),
  custom: z.boolean().optional(),
});
export type PreferenceChoice = z.infer<typeof PreferenceChoiceSchema>;

export const SubmitCardPayloadSchema = z.object({
  tripId: z.uuid(), roundId: z.uuid(), roundType: PreferenceRoundKindSchema,
  choiceId: z.string().regex(/^[a-z0-9_]{2,40}$/), customText: z.string().trim().min(1).max(60).nullable(),
  idempotencyKey: z.uuid(),
}).strict().superRefine((value, context) => {
  if ((value.choiceId === 'custom') !== (value.customText !== null)) context.addIssue({ code: 'custom', path: ['customText'], message: 'Custom text is only allowed for the custom Must-Have card.' });
  if (value.choiceId === 'custom' && value.roundType !== 'must_have') context.addIssue({ code: 'custom', path: ['choiceId'], message: 'Only Must-Have supports a custom card.' });
});
export type SubmitCardPayload = z.infer<typeof SubmitCardPayloadSchema>;

export const ManageRoundPayloadSchema = z.object({ tripId: z.uuid(), action: z.enum(['start', 'close', 'advance']), idempotencyKey: z.uuid() }).strict();
export type ManageRoundPayload = z.infer<typeof ManageRoundPayloadSchema>;

export const RoundParticipantSchema = z.object({ memberId: z.uuid(), displayName: z.string().min(1).max(50), discriminator: z.number().int().positive(), submitted: z.boolean(), removed: z.boolean() });
const StoredChoiceSchema = z.object({ choiceId: z.string().min(1).max(40), customText: z.string().max(60).nullable(), value: z.string().min(1).max(160), updatedAt: z.iso.datetime({ offset: true }) });
export const RevealedPreferenceSchema = StoredChoiceSchema.extend({ memberId: z.uuid(), displayName: z.string().min(1).max(50), discriminator: z.number().int().positive() });
export const PreferenceRoundSchema = z.object({
  roundId: z.uuid(), sequence: z.number().int().min(1).max(3), kind: PreferenceRoundKindSchema,
  status: z.enum(['collecting', 'revealed', 'closed']), createdAt: z.iso.datetime({ offset: true }), revealedAt: z.iso.datetime({ offset: true }).nullable(), closedAt: z.iso.datetime({ offset: true }).nullable(),
  participantCount: z.number().int().nonnegative(), submittedCount: z.number().int().nonnegative(), participants: z.array(RoundParticipantSchema).max(8),
  ownSubmission: StoredChoiceSchema.nullable(), revealedSubmissions: z.array(RevealedPreferenceSchema).max(8),
});
export type PreferenceRound = z.infer<typeof PreferenceRoundSchema>;
export const TripRoomSchema = z.object({ tripId: z.uuid(), tripName: z.string().min(2).max(80), currentMemberId: z.uuid(), currentRole: z.enum(['organizer', 'member']), complete: z.boolean(), currentRound: PreferenceRoundSchema.nullable() });
export type TripRoom = z.infer<typeof TripRoomSchema>;
