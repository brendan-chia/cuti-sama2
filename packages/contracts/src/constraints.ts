import { z } from 'zod';

import { PlanningModeSchema } from './trip';

export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, 'Enter a real calendar date.');

export const CurrencyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code such as MYR or USD.');

const optionalText = (maximum: number) => z.string().trim().min(1).max(maximum).nullable();
const optionalPositiveMoney = z.number().finite().positive().max(999_999_999.99).nullable();

export const ConstraintInputSchema = z.object({
  origin: optionalText(120),
  startsOn: IsoDateSchema.nullable(),
  endsOn: IsoDateSchema.nullable(),
  dateFlexibilityDays: z.number().int().min(0).max(365).nullable(),
  budgetMin: optionalPositiveMoney,
  budgetMax: optionalPositiveMoney,
  currency: CurrencyCodeSchema.nullable(),
  maxTravelMinutes: z.number().int().positive().max(10_080).nullable(),
  accessibilityRequirements: optionalText(1_000),
  accessibilityVisibilityConsent: z.boolean(),
  climate: optionalText(120),
  visaConcern: optionalText(500),
  transport: optionalText(500),
  accommodation: optionalText(500),
}).superRefine((value, context) => {
  if (value.startsOn && value.endsOn && value.endsOn < value.startsOn) {
    context.addIssue({ code: 'custom', path: ['endsOn'], message: 'End date cannot be before the start date.' });
  }
  if ((value.budgetMin === null) !== (value.budgetMax === null)) {
    context.addIssue({ code: 'custom', path: [value.budgetMin === null ? 'budgetMin' : 'budgetMax'], message: 'Enter both ends of the budget range.' });
  }
  if (value.budgetMin !== null && value.budgetMax !== null && value.budgetMax < value.budgetMin) {
    context.addIssue({ code: 'custom', path: ['budgetMax'], message: 'Maximum budget must be at least the minimum budget.' });
  }
  if ((value.budgetMin !== null || value.budgetMax !== null) && value.currency === null) {
    context.addIssue({ code: 'custom', path: ['currency'], message: 'Choose a currency for the budget.' });
  }
  if (value.budgetMin === null && value.budgetMax === null && value.currency !== null) {
    context.addIssue({ code: 'custom', path: ['currency'], message: 'Enter a budget range for this currency.' });
  }
  if (value.accessibilityRequirements && !value.accessibilityVisibilityConsent) {
    context.addIssue({ code: 'custom', path: ['accessibilityVisibilityConsent'], message: 'Confirm who can see accessibility information before saving.' });
  }
});

export type ConstraintInput = z.infer<typeof ConstraintInputSchema>;

export const ConstraintRequestSchema = ConstraintInputSchema.and(z.object({
  tripId: z.uuid(),
  idempotencyKey: z.uuid(),
}));

export type ConstraintRequest = z.infer<typeof ConstraintRequestSchema>;

export const MemberConstraintSchema = ConstraintInputSchema.and(z.object({
  submittedAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
}));

export type MemberConstraint = z.infer<typeof MemberConstraintSchema>;

export const ConstraintMemberStatusSchema = z.object({
  memberId: z.uuid(),
  displayName: z.string().min(1).max(50),
  discriminator: z.number().int().positive(),
  complete: z.boolean(),
});

export const ConstraintCollectionSchema = z.object({
  tripId: z.uuid(),
  tripName: z.string().min(2).max(80),
  mode: PlanningModeSchema,
  currentMemberId: z.uuid(),
  currentRole: z.enum(['organizer', 'member']),
  lockedAt: z.iso.datetime({ offset: true }).nullable(),
  canLock: z.boolean(),
  members: z.array(ConstraintMemberStatusSchema).min(1).max(8),
  ownConstraint: MemberConstraintSchema.nullable(),
});

export type ConstraintCollection = z.infer<typeof ConstraintCollectionSchema>;
