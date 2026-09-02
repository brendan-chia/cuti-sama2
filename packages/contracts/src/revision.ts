import { z } from 'zod';

import { StoredItinerarySchema } from './itinerary';

const IsoTimestampSchema = z.iso.datetime({ offset: true });

export const RevisionInstructionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('pace'), pace: z.enum(['relaxed', 'balanced', 'full']) }).strict(),
  z.object({
    kind: z.literal('replace_activity'),
    activityId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
    replacementBrief: z.string().trim().min(3).max(240),
  }).strict(),
  z.object({
    kind: z.literal('budget_cap'),
    amount: z.number().finite().positive().max(1_000_000),
    currency: z.string().regex(/^[A-Z]{3}$/),
  }).strict(),
]);
export type RevisionInstruction = z.infer<typeof RevisionInstructionSchema>;

export const DayEstimateSchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  minimum: z.number().finite().nonnegative(),
  maximum: z.number().finite().nonnegative(),
}).strict();

export const ItineraryDayDiffSchema = z.object({
  dayNumber: z.number().int().positive(),
  change: z.enum(['added', 'removed', 'changed']),
  activityChanges: z.array(z.object({
    activityId: z.string(),
    change: z.enum(['added', 'removed', 'changed']),
    beforeTitle: z.string().nullable(),
    afterTitle: z.string().nullable(),
  }).strict()),
  beforeEstimate: DayEstimateSchema,
  afterEstimate: DayEstimateSchema,
}).strict();

export const ItineraryDiffSchema = z.object({
  changedDays: z.array(ItineraryDayDiffSchema),
  beforeEstimate: DayEstimateSchema,
  afterEstimate: DayEstimateSchema,
}).strict();
export type ItineraryDiff = z.infer<typeof ItineraryDiffSchema>;

export const ReviseItineraryRequestSchema = z.object({
  tripId: z.uuid(),
  baseVersionId: z.uuid(),
  idempotencyKey: z.uuid(),
  instruction: RevisionInstructionSchema,
}).strict();
export type ReviseItineraryRequest = z.infer<typeof ReviseItineraryRequestSchema>;

export const RevisionPreviewSchema = z.object({
  revisionId: z.uuid(),
  baseVersionId: z.uuid(),
  status: z.enum(['processing', 'ready']),
  instruction: RevisionInstructionSchema,
  candidate: StoredItinerarySchema,
  diff: ItineraryDiffSchema,
}).strict();
export type RevisionPreview = z.infer<typeof RevisionPreviewSchema>;

export const ReviseItineraryResponseSchema = z.object({
  tripId: z.uuid(),
  preview: RevisionPreviewSchema,
}).strict();

export const ActivateItineraryRequestSchema = z.object({
  tripId: z.uuid(),
  versionId: z.uuid(),
  expectedActiveVersionId: z.uuid(),
}).strict();

export const ActivateItineraryResponseSchema = z.object({
  tripId: z.uuid(),
  activeVersionId: z.uuid(),
}).strict();

export const RevisionHistoryItemSchema = z.object({
  versionId: z.uuid(),
  version: z.number().int().positive(),
  generatedAt: IsoTimestampSchema,
  active: z.boolean(),
  instruction: RevisionInstructionSchema.nullable(),
}).strict();

export const ItineraryRevisionStateSchema = z.object({
  tripId: z.uuid(),
  tripName: z.string().min(2).max(80),
  currentRole: z.enum(['organizer', 'member']),
  active: StoredItinerarySchema.nullable(),
  history: z.array(RevisionHistoryItemSchema),
  pending: RevisionPreviewSchema.nullable(),
}).strict();
export type ItineraryRevisionState = z.infer<typeof ItineraryRevisionStateSchema>;
