import { z } from 'zod';

const amountError = 'Enter a whole amount from RM 1 to RM 1,000,000.';
export const BudgetAmountSchema = z.number({ error: amountError }).int(amountError).min(1, amountError).max(1_000_000, amountError);
export const ParticipantBudgetSchema = z.object({
  comfortableBudgetMYR: BudgetAmountSchema,
  maxBudgetMYR: BudgetAmountSchema,
}).strict().refine(budget => budget.maxBudgetMYR >= budget.comfortableBudgetMYR, {
  message: 'Your absolute maximum must be at least your comfortable spending.', path: ['maxBudgetMYR'],
});
export type ParticipantBudget = z.infer<typeof ParticipantBudgetSchema>;
export const CrewBudgetSchema = z.object({
  submittedCount: z.number().int().positive(),
  crewComfortCeiling: BudgetAmountSchema,
  crewHardCeiling: BudgetAmountSchema,
  currency: z.literal('MYR'),
}).strict().refine(budget => budget.crewHardCeiling >= budget.crewComfortCeiling);
export type CrewBudget = z.infer<typeof CrewBudgetSchema>;
export type BudgetParticipant = { active: boolean; budget: ParticipantBudget | null };
export type Affordability = 'comfortable' | 'stretch' | 'infeasible';
export type StrainClass = 'comfortable' | 'slight_stretch' | 'stretch' | 'near_limit' | 'infeasible';
export const STRAIN_THRESHOLDS = Object.freeze({ slightStretch: 0.25, stretch: 0.75 });

function validateCost(cost: number) {
  if (!Number.isFinite(cost) || cost < 0) throw new RangeError('Cost must be a finite, non-negative MYR amount.');
}

/** Run on private inputs in a trusted context; only return this aggregate to the crew. */
export function calculateCrewBudget(participants: readonly BudgetParticipant[]): CrewBudget | null {
  const active = participants.filter(participant => participant.active);
  if (!active.length || active.some(participant => participant.budget === null)) return null;
  const budgets = active.map(participant => ParticipantBudgetSchema.parse(participant.budget));
  return { submittedCount: budgets.length, crewComfortCeiling: Math.min(...budgets.map(b => b.comfortableBudgetMYR)),
    crewHardCeiling: Math.min(...budgets.map(b => b.maxBudgetMYR)), currency: 'MYR' };
}

export function classifyAffordability(cost: number, budget: CrewBudget): Affordability {
  validateCost(cost);
  const valid = CrewBudgetSchema.parse(budget);
  return cost <= valid.crewComfortCeiling ? 'comfortable' : cost <= valid.crewHardCeiling ? 'stretch' : 'infeasible';
}

export function calculateBudgetStrain(cost: number, budget: ParticipantBudget): { strain: number | null; infeasible: boolean } {
  validateCost(cost);
  const { comfortableBudgetMYR: comfortable, maxBudgetMYR: maximum } = ParticipantBudgetSchema.parse(budget);
  if (cost <= comfortable) return { strain: 0, infeasible: false };
  if (cost > maximum) return { strain: null, infeasible: true };
  // Equal endpoints are handled by the two branches above, so this denominator is positive.
  return { strain: (cost - comfortable) / (maximum - comfortable), infeasible: false };
}

export function classifyBudgetStrain(cost: number, budget: ParticipantBudget): StrainClass {
  const result = calculateBudgetStrain(cost, budget);
  if (result.infeasible) return 'infeasible';
  const strain = result.strain!;
  if (strain === 0) return 'comfortable';
  if (strain <= STRAIN_THRESHOLDS.slightStretch) return 'slight_stretch';
  return strain <= STRAIN_THRESHOLDS.stretch ? 'stretch' : 'near_limit';
}

/** Anonymous counts only: never carry names, IDs, private values, or numerical strains. */
export function aggregateBudgetAffordability(cost: number, participants: readonly BudgetParticipant[]) {
  validateCost(cost);
  if (!calculateCrewBudget(participants)) return null;
  const counts = { travellerCount: 0, comfortable: 0, stretching: 0, infeasible: 0 };
  for (const participant of participants.filter(p => p.active)) {
    const state = classifyBudgetStrain(cost, participant.budget!);
    counts.travellerCount++;
    if (state === 'comfortable') counts.comfortable++;
    else if (state === 'infeasible') counts.infeasible++;
    else counts.stretching++;
  }
  return counts;
}

export function parseBudgetInput(comfortable: string, maximum: string) {
  return ParticipantBudgetSchema.safeParse({
    comfortableBudgetMYR: /^\d+$/.test(comfortable.trim()) ? Number(comfortable) : NaN,
    maxBudgetMYR: /^\d+$/.test(maximum.trim()) ? Number(maximum) : NaN,
  });
}
