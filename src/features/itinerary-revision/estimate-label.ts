import type { z } from 'zod';
import { DayEstimateSchema } from '../../../packages/contracts/src/revision';

type Estimate = z.infer<typeof DayEstimateSchema>;
export function estimateLabel(value: Estimate) {
  const currency = value.currency ?? 'Mixed currencies';
  return `${currency} ${value.minimum.toLocaleString()}–${value.maximum.toLocaleString()} per person`;
}
