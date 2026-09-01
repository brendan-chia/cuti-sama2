import { z } from 'zod';

import { PlanningModeSchema } from './trip';

export const DestinationConstraintCategorySchema = z.enum([
  'budget', 'travel_time', 'climate', 'visa', 'accessibility', 'transport', 'accommodation', 'dealbreaker',
]);
export type DestinationConstraintCategory = z.infer<typeof DestinationConstraintCategorySchema>;

export const EvidenceStatusSchema = z.enum(['verified', 'estimated', 'unavailable']);
export const EvidenceSchema = z.object({
  status: EvidenceStatusSchema,
  label: z.string().min(1).max(120),
  sourceLabel: z.string().min(1).max(120).nullable(),
  sourceUrl: z.url().nullable(),
  observedAt: z.iso.datetime({ offset: true }).nullable(),
  stale: z.boolean(),
}).strict();
export type Evidence = z.infer<typeof EvidenceSchema>;

export const DestinationEstimateSchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  minimum: z.number().finite().nonnegative().nullable(),
  maximum: z.number().finite().nonnegative().nullable(),
  evidence: EvidenceSchema,
}).strict().superRefine((value, context) => {
  if ((value.minimum === null) !== (value.maximum === null) || (value.minimum !== null && value.currency === null)) {
    context.addIssue({ code: 'custom', message: 'Estimate values and currency must be supplied together.' });
  }
  if (value.minimum !== null && value.maximum !== null && value.minimum > value.maximum) {
    context.addIssue({ code: 'custom', path: ['maximum'], message: 'Estimate maximum must be at least the minimum.' });
  }
});

export const DestinationTravelTimeSchema = z.object({
  origin: z.string().min(1).max(120),
  minutes: z.number().int().nonnegative().nullable(),
  evidence: EvidenceSchema,
}).strict();

export const CatalogueDestinationSchema = z.object({
  catalogueId: z.uuid(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1).max(120),
  country: z.string().min(1).max(120),
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  enabled: z.boolean(),
  estimate: DestinationEstimateSchema,
  travelTimes: z.array(DestinationTravelTimeSchema).max(30),
  interests: z.array(z.string().min(1).max(80)).max(20),
  climateTags: z.array(z.string().min(1).max(80)).max(20),
  visaTags: z.array(z.string().min(1).max(80)).max(20),
  accessibilityTags: z.array(z.string().min(1).max(120)).max(20),
  transportTags: z.array(z.string().min(1).max(120)).max(20),
  accommodationTags: z.array(z.string().min(1).max(120)).max(20),
  primaryCompromise: z.string().min(1).max(240),
  evidence: z.object({
    visa: EvidenceSchema, safety: EvidenceSchema, openingHours: EvidenceSchema, availability: EvidenceSchema,
  }).strict(),
}).strict();
export type CatalogueDestination = z.infer<typeof CatalogueDestinationSchema>;

export const DestinationFilterConstraintsSchema = z.object({
  budgetMinimum: z.number().finite().nonnegative().nullable(),
  budgetMaximum: z.number().finite().nonnegative().nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  origins: z.array(z.string().min(1).max(120)).max(8),
  maxTravelMinutes: z.number().int().positive().nullable(),
  climateTerms: z.array(z.string().min(1).max(120)).max(16),
  visaTerms: z.array(z.string().min(1).max(120)).max(16),
  accessibilityTerms: z.array(z.string().min(1).max(240)).max(16),
  transportTerms: z.array(z.string().min(1).max(240)).max(16),
  accommodationTerms: z.array(z.string().min(1).max(240)).max(16),
  dealbreakerTerms: z.array(z.string().min(1).max(240)).max(16),
}).strict();
export type DestinationFilterConstraints = z.infer<typeof DestinationFilterConstraintsSchema>;

export const DestinationEvaluationSchema = z.object({
  eligible: z.boolean(),
  failedCategories: z.array(DestinationConstraintCategorySchema).max(8),
  matchReasons: z.array(z.string().min(1).max(240)).max(8),
}).strict();
export type DestinationEvaluation = z.infer<typeof DestinationEvaluationSchema>;

export const DestinationConfidenceSchema = z.object({
  level: z.enum(['high', 'medium', 'low']),
  label: z.string().min(1).max(80),
  warning: z.string().min(1).max(240).nullable(),
}).strict();
export type DestinationConfidence = z.infer<typeof DestinationConfidenceSchema>;

export const DestinationCardSchema = z.object({
  destinationId: z.string().min(1).max(160),
  catalogueId: z.uuid().nullable(),
  name: z.string().min(1).max(120),
  country: z.string().min(1).max(120).nullable(),
  supported: z.boolean(),
  eligible: z.boolean(),
  excludedBy: z.array(DestinationConstraintCategorySchema).max(8),
  matchReasons: z.array(z.string().min(1).max(240)).max(8),
  estimate: DestinationEstimateSchema,
  travelTimes: z.array(DestinationTravelTimeSchema).max(8),
  interests: z.array(z.string().min(1).max(80)).max(20),
  primaryCompromise: z.string().min(1).max(240),
  confidence: DestinationConfidenceSchema,
  provenance: z.array(EvidenceSchema).min(1).max(20),
}).strict();
export type DestinationCard = z.infer<typeof DestinationCardSchema>;

export const DestinationResultSchema = z.object({
  tripId: z.uuid(),
  tripName: z.string().min(2).max(80),
  mode: PlanningModeSchema,
  kind: z.enum(['locked', 'comparison', 'discovery']),
  destinations: z.array(DestinationCardSchema).max(5),
  noMatch: z.object({ revisionCategories: z.array(DestinationConstraintCategorySchema).min(1).max(8) }).strict().nullable(),
  generatedAt: z.iso.datetime({ offset: true }),
}).strict().superRefine((value, context) => {
  if (value.mode === 'undecided' && value.destinations.length > 3) context.addIssue({ code: 'custom', path: ['destinations'], message: 'Discovery returns at most three destinations.' });
  if (value.mode === 'shortlist' && (value.destinations.length < 2 || value.destinations.length > 5)) context.addIssue({ code: 'custom', path: ['destinations'], message: 'Shortlist comparison requires two to five destinations.' });
  if (value.mode === 'destination_locked' && value.destinations.length !== 1) context.addIssue({ code: 'custom', path: ['destinations'], message: 'Locked mode requires one destination.' });
  if (value.noMatch && value.destinations.length > 0) context.addIssue({ code: 'custom', path: ['noMatch'], message: 'No-match output cannot include destinations.' });
});
export type DestinationResult = z.infer<typeof DestinationResultSchema>;

export const DestinationRequestSchema = z.object({ tripId: z.uuid() }).strict();

export const AiDestinationAnnotationsSchema = z.object({
  destinations: z.array(z.object({
    destinationId: z.string().min(1).max(160),
    reasonOrder: z.array(z.number().int().nonnegative()).max(8),
  }).strict()).max(5),
}).strict();
