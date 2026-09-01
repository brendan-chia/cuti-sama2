import { z } from 'zod';

export const planningModes = ['destination_locked', 'shortlist', 'undecided'] as const;

export const PlanningModeSchema = z.enum(planningModes);
export type PlanningMode = z.infer<typeof PlanningModeSchema>;

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, 'Enter a real calendar date.');

export const CreateTripRequestSchema = z
  .object({
    tripName: z.string().trim().min(2, 'Trip name must have at least 2 characters.').max(80),
    mode: PlanningModeSchema,
    destinations: z.array(z.string().trim().min(1).max(120)).max(5),
    startsOn: z.union([isoDateSchema, z.null()]),
    endsOn: z.union([isoDateSchema, z.null()]),
    idempotencyKey: z.uuid(),
  })
  .superRefine((value, context) => {
    const normalized = value.destinations.map((item) => item.toLocaleLowerCase());
    if (new Set(normalized).size !== normalized.length) {
      context.addIssue({
        code: 'custom',
        path: ['destinations'],
        message: 'Each destination must be unique.',
      });
    }

    if (value.mode === 'destination_locked' && value.destinations.length !== 1) {
      context.addIssue({
        code: 'custom',
        path: ['destinations'],
        message: 'Locked destination mode requires exactly one destination.',
      });
    }

    if (value.mode === 'shortlist' && (value.destinations.length < 2 || value.destinations.length > 5)) {
      context.addIssue({
        code: 'custom',
        path: ['destinations'],
        message: 'Shortlist mode requires 2 to 5 destinations.',
      });
    }

    if (value.mode === 'undecided' && value.destinations.length !== 0) {
      context.addIssue({
        code: 'custom',
        path: ['destinations'],
        message: 'Undecided mode does not accept destinations yet.',
      });
    }

    if (value.startsOn && value.endsOn && value.endsOn < value.startsOn) {
      context.addIssue({
        code: 'custom',
        path: ['endsOn'],
        message: 'End date cannot be before the start date.',
      });
    }
  });

export type CreateTripRequest = z.infer<typeof CreateTripRequestSchema>;

export const TripSummarySchema = z.object({
  tripId: z.uuid(),
  memberId: z.uuid(),
  tripName: z.string(),
  mode: PlanningModeSchema,
  status: z.literal('draft'),
  destinations: z.array(z.string()),
  startsOn: z.string().nullable(),
  endsOn: z.string().nullable(),
});

export type TripSummary = z.infer<typeof TripSummarySchema>;
