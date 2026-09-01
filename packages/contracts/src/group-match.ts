import { z } from 'zod';

import { PlanningModeSchema } from './trip';

export const MatchFactKindSchema = z.enum([
  'agreement',
  'minority_must_have',
  'dealbreaker',
  'unresolved_conflict',
]);
export type MatchFactKind = z.infer<typeof MatchFactKindSchema>;

export const MatchConstraintCategorySchema = z.enum([
  'dates',
  'budget',
  'travel_time',
  'origin',
  'accessibility',
  'climate',
  'visa',
  'transport',
  'accommodation',
  'preference',
]);
export type MatchConstraintCategory = z.infer<typeof MatchConstraintCategorySchema>;

export const MatchSourceSchema = z.object({
  sourceId: z.string().min(1).max(160),
  memberId: z.uuid(),
  attribution: z.string().min(1).max(80).nullable(),
  groupVisible: z.boolean(),
  inputKind: z.enum(['constraint', 'preference']),
  category: MatchConstraintCategorySchema,
  value: z.string().min(1).max(1_000),
}).strict();
export type MatchSource = z.infer<typeof MatchSourceSchema>;

export const MatchFactSchema = z.object({
  factId: z.string().regex(/^[a-z0-9][a-z0-9:_-]*$/),
  kind: MatchFactKindSchema,
  category: MatchConstraintCategorySchema,
  title: z.string().min(1).max(160),
  detail: z.string().min(1).max(500),
  sourceIds: z.array(z.string().min(1)).min(1).max(16),
}).strict();
export type MatchFact = z.infer<typeof MatchFactSchema>;

export const MatchNextActionSchema = z.object({
  kind: z.enum(['compare_shortlist', 'discover_destinations', 'generate_itinerary']),
  label: z.string().min(1).max(80),
  route: z.string().min(1).max(240),
}).strict();
export type MatchNextAction = z.infer<typeof MatchNextActionSchema>;

export const GroupMatchResultSchema = z.object({
  runId: z.uuid().nullable(),
  tripId: z.uuid(),
  tripName: z.string().min(2).max(80),
  mode: PlanningModeSchema,
  status: z.enum(['matched', 'blocked']),
  facts: z.array(MatchFactSchema).max(100),
  sources: z.array(MatchSourceSchema).max(200),
  blockingCategories: z.array(MatchConstraintCategorySchema).max(10),
  nextAction: MatchNextActionSchema,
  generatedAt: z.iso.datetime({ offset: true }),
  prose: z.object({
    heading: z.string().min(1).max(120),
    summary: z.string().min(1).max(500),
    factWording: z.record(z.string(), z.string().min(1).max(500)),
    source: z.enum(['deterministic', 'groq']),
  }).strict(),
}).strict().superRefine((value, context) => {
  const sourceIds = new Set(value.sources.map((source) => source.sourceId));
  for (const [index, fact] of value.facts.entries()) {
    for (const sourceId of fact.sourceIds) {
      if (!sourceIds.has(sourceId)) context.addIssue({ code: 'custom', path: ['facts', index, 'sourceIds'], message: `Unknown source: ${sourceId}` });
    }
  }
  if (value.status === 'blocked' && value.blockingCategories.length === 0) {
    context.addIssue({ code: 'custom', path: ['blockingCategories'], message: 'Blocked results must name at least one category.' });
  }
  if (value.status === 'matched' && value.blockingCategories.length > 0) {
    context.addIssue({ code: 'custom', path: ['blockingCategories'], message: 'Matched results cannot contain blocking categories.' });
  }
});
export type GroupMatchResult = z.infer<typeof GroupMatchResultSchema>;

export const GroupMatchRequestSchema = z.object({ tripId: z.uuid() }).strict();

export const AiMatchWordingSchema = z.object({
  heading: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(500),
  facts: z.array(z.object({
    factId: z.string().regex(/^[a-z0-9][a-z0-9:_-]*$/),
    wording: z.string().trim().min(1).max(500),
  }).strict()).max(100),
}).strict();
export type AiMatchWording = z.infer<typeof AiMatchWordingSchema>;

const NullableTextSchema = z.string().trim().min(1).max(1_000).nullable();
export const GroupMatchMemberInputSchema = z.object({
  memberId: z.uuid(),
  displayName: z.string().min(1).max(50),
  discriminator: z.number().int().positive(),
  constraints: z.object({
    startsOn: z.iso.date().nullable(),
    endsOn: z.iso.date().nullable(),
    budgetMin: z.number().finite().positive().nullable(),
    budgetMax: z.number().finite().positive().nullable(),
    currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
    maxTravelMinutes: z.number().int().positive().nullable(),
    origin: NullableTextSchema,
    accessibility: NullableTextSchema,
    accessibilityVisibilityConsent: z.boolean(),
    climate: NullableTextSchema,
    visa: NullableTextSchema,
    transport: NullableTextSchema,
    accommodation: NullableTextSchema,
  }).strict(),
  preferences: z.array(z.object({
    submissionId: z.string().min(1).max(160),
    kind: z.enum(['vibe', 'pace', 'must_have', 'nice_to_have', 'avoid']),
    value: z.string().trim().min(1).max(240),
    groupVisible: z.boolean(),
  }).strict()).max(5),
}).strict();

export const GroupMatchInputSchema = z.object({
  tripId: z.uuid(),
  tripName: z.string().min(2).max(80),
  mode: PlanningModeSchema,
  members: z.array(GroupMatchMemberInputSchema).min(1).max(8),
  generatedAt: z.iso.datetime({ offset: true }),
}).strict();
export type GroupMatchInput = z.infer<typeof GroupMatchInputSchema>;
