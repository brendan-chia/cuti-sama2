import {
  ConstraintRequestSchema,
  type ConstraintInput,
  type ConstraintRequest,
} from '../../packages/contracts/src/constraints';
import type { PlanningMode } from '../../packages/contracts/src/trip';
import { createUuid } from '@/lib/uuid';

export type ConstraintFormValues = Record<
  'origin' | 'startsOn' | 'endsOn' | 'dateFlexibilityDays' | 'budgetMin' | 'budgetMax' |
  'maxTravelHours' | 'accessibilityRequirements' | 'climate' | 'visaConcern' |
  'transport' | 'accommodation', string
> & { accessibilityVisibilityConsent: boolean };

export type ConstraintField = keyof ConstraintFormValues | 'form';
export type ConstraintErrors = Partial<Record<ConstraintField, string>>;

export const initialConstraintForm: ConstraintFormValues = {
  origin: '', startsOn: '', endsOn: '', dateFlexibilityDays: '', budgetMin: '', budgetMax: '',
  maxTravelHours: '', accessibilityRequirements: '', accessibilityVisibilityConsent: false,
  climate: '', visaConcern: '', transport: '', accommodation: '',
};

const nullableText = (value: string) => value.trim() || null;
const nullableNumber = (value: string) => value.trim() === '' ? null : Number(value);

export function constraintToForm(value: ConstraintInput | null): ConstraintFormValues {
  if (!value) return initialConstraintForm;
  return {
    origin: value.origin ?? '', startsOn: value.startsOn ?? '', endsOn: value.endsOn ?? '',
    dateFlexibilityDays: value.dateFlexibilityDays?.toString() ?? '',
    budgetMin: value.budgetMin?.toString() ?? '', budgetMax: value.budgetMax?.toString() ?? '',
    maxTravelHours: value.maxTravelMinutes === null ? '' : String(value.maxTravelMinutes / 60),
    accessibilityRequirements: value.accessibilityRequirements ?? '',
    accessibilityVisibilityConsent: value.accessibilityVisibilityConsent,
    climate: value.climate ?? '', visaConcern: value.visaConcern ?? '', transport: value.transport ?? '',
    accommodation: value.accommodation ?? '',
  };
}

export function buildConstraintRequest(
  tripId: string,
  mode: PlanningMode,
  values: ConstraintFormValues,
  idempotencyKey = createUuid(),
): { success: true; data: ConstraintRequest } | { success: false; errors: ConstraintErrors } {
  const budgetMin = nullableNumber(values.budgetMin);
  const budgetMax = nullableNumber(values.budgetMax);
  const input = {
    tripId, idempotencyKey,
    origin: nullableText(values.origin), startsOn: nullableText(values.startsOn), endsOn: nullableText(values.endsOn),
    dateFlexibilityDays: nullableNumber(values.dateFlexibilityDays),
    budgetMin, budgetMax,
    currency: budgetMin !== null || budgetMax !== null ? 'MYR' : null,
    maxTravelMinutes: values.maxTravelHours.trim() === '' ? null : Number(values.maxTravelHours) * 60,
    accessibilityRequirements: nullableText(values.accessibilityRequirements),
    accessibilityVisibilityConsent: values.accessibilityVisibilityConsent,
    climate: nullableText(values.climate), visaConcern: nullableText(values.visaConcern),
    transport: nullableText(values.transport), accommodation: nullableText(values.accommodation),
  };

  const result = ConstraintRequestSchema.safeParse(input);
  const errors: ConstraintErrors = {};
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0] === 'maxTravelMinutes' ? 'maxTravelHours' : issue.path[0];
      if (typeof field === 'string' && field in values) errors[field as keyof ConstraintFormValues] ??= issue.message;
      else errors.form ??= issue.message;
    }
  }

  if (mode === 'undecided') {
    const required: [keyof ConstraintFormValues, string][] = [
      ['origin', 'Origin is required while the destination is undecided.'],
      ['startsOn', 'A start date is required while the destination is undecided.'],
      ['endsOn', 'An end date is required while the destination is undecided.'],
      ['dateFlexibilityDays', 'Date flexibility is required; enter 0 for fixed dates.'],
      ['budgetMin', 'A minimum budget is required while the destination is undecided.'],
      ['budgetMax', 'A maximum budget is required while the destination is undecided.'],
      ['maxTravelHours', 'Maximum travel time is required while the destination is undecided.'],
      ['accessibilityRequirements', 'Accessibility requirements are required; enter None if there are none.'],
    ];
    for (const [field, message] of required) if (String(values[field]).trim() === '') errors[field] ??= message;
    if (!values.accessibilityVisibilityConsent) errors.accessibilityVisibilityConsent ??= 'Confirm who can see accessibility information before saving.';
  }

  return Object.keys(errors).length || !result.success
    ? { success: false, errors }
    : { success: true, data: result.data };
}
