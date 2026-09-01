import * as Crypto from 'expo-crypto';
import { z } from 'zod';

import {
  CreateTripRequestSchema,
  TripSummarySchema,
  type CreateTripRequest,
  type PlanningMode,
} from '../../../packages/contracts/src/trip';

export type CreateTripFormValues = {
  tripName: string;
  mode: PlanningMode;
  lockedDestination: string;
  shortlist: string;
  startsOn: string;
  endsOn: string;
};

export type CreateTripField = keyof CreateTripFormValues | 'form';
export type CreateTripErrors = Partial<Record<CreateTripField, string>>;

export const initialCreateTripForm: CreateTripFormValues = {
  tripName: '',
  mode: 'destination_locked',
  lockedDestination: '',
  shortlist: '',
  startsOn: '',
  endsOn: '',
};

function splitShortlist(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function destinationField(mode: PlanningMode): CreateTripField {
  return mode === 'shortlist' ? 'shortlist' : 'lockedDestination';
}

export function buildCreateTripRequest(
  values: CreateTripFormValues,
  idempotencyKey = Crypto.randomUUID(),
): { success: true; data: CreateTripRequest } | { success: false; errors: CreateTripErrors } {
  const destinations =
    values.mode === 'destination_locked'
      ? [values.lockedDestination.trim()].filter(Boolean)
      : values.mode === 'shortlist'
        ? splitShortlist(values.shortlist)
        : [];

  const result = CreateTripRequestSchema.safeParse({
    tripName: values.tripName,
    mode: values.mode,
    destinations,
    startsOn: values.startsOn.trim() || null,
    endsOn: values.endsOn.trim() || null,
    idempotencyKey,
  });

  if (result.success) {
    return result;
  }

  const errors: CreateTripErrors = {};
  for (const issue of result.error.issues) {
    const root = issue.path[0];
    let field: CreateTripField = 'form';
    if (root === 'tripName' || root === 'startsOn' || root === 'endsOn') {
      field = root;
    } else if (root === 'destinations') {
      field = destinationField(values.mode);
    }
    errors[field] ??= issue.message;
  }

  return { success: false, errors };
}

export function parseTripSummary(value: unknown) {
  return TripSummarySchema.parse(value);
}

export function readableValidationError(error: unknown) {
  if (error instanceof z.ZodError) {
    return 'The server returned trip data in an unexpected format.';
  }
  return error instanceof Error ? error.message : 'Something went wrong while creating the trip.';
}
