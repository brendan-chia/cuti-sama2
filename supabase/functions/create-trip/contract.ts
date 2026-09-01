import { z } from 'zod';

const PlanningModeSchema = z.enum(['destination_locked', 'shortlist', 'undecided']);
const DateSchema = z.union([z.iso.date(), z.null()]);

export const CreateTripPayloadSchema = z
  .object({
    tripName: z.string().trim().min(2).max(80),
    mode: PlanningModeSchema,
    destinations: z.array(z.string().trim().min(1).max(120)).max(5),
    startsOn: DateSchema,
    endsOn: DateSchema,
    idempotencyKey: z.uuid(),
  })
  .superRefine((value, context) => {
    const unique = new Set(value.destinations.map((item) => item.toLocaleLowerCase()));
    if (unique.size !== value.destinations.length) {
      context.addIssue({ code: 'custom', path: ['destinations'], message: 'Destinations must be unique.' });
    }
    if (value.mode === 'destination_locked' && value.destinations.length !== 1) {
      context.addIssue({ code: 'custom', path: ['destinations'], message: 'Exactly one destination is required.' });
    }
    if (value.mode === 'shortlist' && (value.destinations.length < 2 || value.destinations.length > 5)) {
      context.addIssue({ code: 'custom', path: ['destinations'], message: 'Two to five destinations are required.' });
    }
    if (value.mode === 'undecided' && value.destinations.length !== 0) {
      context.addIssue({ code: 'custom', path: ['destinations'], message: 'Undecided mode cannot include destinations.' });
    }
    if (value.startsOn && value.endsOn && value.endsOn < value.startsOn) {
      context.addIssue({ code: 'custom', path: ['endsOn'], message: 'End date cannot be before start date.' });
    }
  });
