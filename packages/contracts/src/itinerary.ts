import { z } from 'zod';

const IsoTimestampSchema = z.iso.datetime({ offset: true });
const TimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour HH:mm time.');

export const ItineraryConfidenceSchema = z.object({
  level: z.enum(['high', 'medium', 'low']),
  score: z.number().int().min(0).max(100),
  reason: z.string().trim().min(1).max(300),
}).strict();

export const ItineraryEstimateSchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/),
  minimum: z.number().finite().nonnegative(),
  maximum: z.number().finite().nonnegative(),
  basis: z.enum(['per_person', 'group']),
  sourceTimestamp: IsoTimestampSchema,
}).strict().refine((value) => value.maximum >= value.minimum, {
  path: ['maximum'], message: 'Estimate maximum must be at least its minimum.',
});

export const ItineraryLocationSchema = z.object({
  name: z.string().trim().min(1).max(160),
  address: z.string().trim().min(1).max(240).nullable(),
  latitude: z.number().finite().min(-90).max(90).nullable(),
  longitude: z.number().finite().min(-180).max(180).nullable(),
}).strict().superRefine((value, context) => {
  if ((value.latitude === null) !== (value.longitude === null)) {
    context.addIssue({ code: 'custom', message: 'Latitude and longitude must be supplied together.' });
  }
});

export const ItineraryTimeBlockSchema = z.object({
  start: TimeSchema,
  end: TimeSchema,
  timezone: z.string().trim().min(1).max(80),
}).strict().refine((value) => value.end > value.start, {
  path: ['end'], message: 'An activity must end after it starts.',
});

export const ItineraryActivitySchema = z.object({
  activityId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(600),
  timeBlock: ItineraryTimeBlockSchema,
  location: ItineraryLocationSchema,
  estimate: ItineraryEstimateSchema,
  travelMinutes: z.number().int().nonnegative().max(1_440).nullable(),
  rationale: z.object({
    explanation: z.string().trim().min(1).max(400),
    groupSignal: z.enum(['vibe', 'pace', 'must_have', 'nice_to_have', 'accessibility', 'budget']),
  }).strict(),
  warnings: z.array(z.string().trim().min(1).max(300)).max(10),
  confidence: ItineraryConfidenceSchema,
  sourceTimestamps: z.array(IsoTimestampSchema).min(1).max(10),
  tags: z.array(z.string().trim().min(1).max(80)).max(20),
  accessibility: z.object({
    status: z.enum(['confirmed', 'partial', 'unknown', 'not_accessible']),
    features: z.array(z.string().trim().min(1).max(160)).max(20),
    notes: z.string().trim().min(1).max(300).nullable(),
  }).strict(),
}).strict();

export const ItineraryDaySchema = z.object({
  dayNumber: z.number().int().positive().max(30),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  title: z.string().trim().min(1).max(160),
  activities: z.array(ItineraryActivitySchema).min(1).max(12),
}).strict().superRefine((value, context) => {
  for (let index = 1; index < value.activities.length; index += 1) {
    if (value.activities[index - 1].timeBlock.end > value.activities[index].timeBlock.start) {
      context.addIssue({ code: 'custom', path: ['activities', index, 'timeBlock'], message: 'Activity time blocks cannot overlap.' });
    }
  }
});

export const ItineraryDraftSchema = z.object({
  schemaVersion: z.literal('1.0'),
  destination: z.object({
    name: z.string().trim().min(1).max(120),
    country: z.string().trim().min(1).max(120).nullable(),
  }).strict(),
  summary: z.string().trim().min(1).max(800),
  days: z.array(ItineraryDaySchema).min(1).max(30),
  warnings: z.array(z.string().trim().min(1).max(300)).max(20),
  confidence: ItineraryConfidenceSchema,
  sourceTimestamps: z.array(IsoTimestampSchema).min(1).max(20),
}).strict().superRefine((value, context) => {
  const dayNumbers = value.days.map((day) => day.dayNumber);
  if (dayNumbers.some((number, index) => number !== index + 1)) {
    context.addIssue({ code: 'custom', path: ['days'], message: 'Days must be sequential and start at one.' });
  }
  const activityIds = value.days.flatMap((day) => day.activities.map((activity) => activity.activityId));
  if (new Set(activityIds).size !== activityIds.length) {
    context.addIssue({ code: 'custom', path: ['days'], message: 'Activity IDs must be unique.' });
  }
});
export type ItineraryDraft = z.infer<typeof ItineraryDraftSchema>;

export const GenerateItineraryRequestSchema = z.object({
  tripId: z.uuid(),
  idempotencyKey: z.uuid(),
}).strict();
export type GenerateItineraryRequest = z.infer<typeof GenerateItineraryRequestSchema>;

export const StoredItinerarySchema = z.object({
  versionId: z.uuid(),
  version: z.number().int().positive(),
  generatedAt: IsoTimestampSchema,
  itinerary: ItineraryDraftSchema,
}).strict();
export type StoredItinerary = z.infer<typeof StoredItinerarySchema>;

export const ItineraryStateSchema = z.object({
  tripId: z.uuid(),
  tripName: z.string().min(2).max(80),
  currentRole: z.enum(['organizer', 'member']),
  lockedDestination: z.object({
    name: z.string().min(1).max(120),
    country: z.string().min(1).max(120).nullable(),
    lockedAt: IsoTimestampSchema,
  }).strict().nullable(),
  latest: StoredItinerarySchema.nullable(),
  operation: z.object({
    idempotencyKey: z.uuid(),
    status: z.enum(['pending', 'completed', 'failed']),
    startedAt: IsoTimestampSchema,
    error: z.string().min(1).max(500).nullable(),
  }).strict().nullable(),
}).strict();
export type ItineraryState = z.infer<typeof ItineraryStateSchema>;

export const GenerateItineraryResponseSchema = z.object({
  tripId: z.uuid(),
  version: StoredItinerarySchema,
}).strict();
