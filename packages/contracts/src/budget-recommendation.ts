import { z } from 'zod';

export const BudgetEstimateSchema = z.object({
  accommodation: z.number().int().nonnegative().max(500000),
  food: z.number().int().nonnegative().max(500000),
  localTransport: z.number().int().nonnegative().max(500000),
  activities: z.number().int().nonnegative().max(500000),
  returnTravel: z.number().int().nonnegative().max(500000),
  contingency: z.number().int().nonnegative().max(500000),
  assumptions: z.array(z.string().min(1).max(500)).min(1).max(10),
}).strict().refine((value) => budgetTotal(value) > 0 && budgetTotal(value) <= 1000000, 'Estimate must be between RM 1 and RM 1,000,000.');
export type BudgetEstimate = z.infer<typeof BudgetEstimateSchema>;
export function budgetTotal(value: { accommodation: number; food: number; localTransport: number; activities: number; returnTravel: number; contingency: number }) {
  return value.accommodation + value.food + value.localTransport + value.activities + value.returnTravel + value.contingency;
}
