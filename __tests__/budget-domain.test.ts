import { aggregateBudgetAffordability, calculateBudgetStrain, calculateCrewBudget, classifyAffordability, classifyBudgetStrain, CrewBudgetSchema, parseBudgetInput } from '../packages/contracts/src/budget';
import { QuestActionSchema } from '../packages/contracts/src/quest';

const participant = (comfortableBudgetMYR: number, maxBudgetMYR: number, active = true) => ({ active, budget: { comfortableBudgetMYR, maxBudgetMYR } });
describe('private whole-trip budgets', () => {
  it('uses separate minima, including when different travellers set the ceilings', () => {
    expect(calculateCrewBudget([participant(1000, 4000), participant(2000, 3000)])).toEqual({ submittedCount: 2, crewComfortCeiling: 1000, crewHardCeiling: 3000, currency: 'MYR' });
    expect(calculateCrewBudget([participant(2000, 3000), participant(2000, 3000)])).toEqual({ submittedCount: 2, crewComfortCeiling: 2000, crewHardCeiling: 3000, currency: 'MYR' });
  });
  it('waits for every active submission and excludes inactive participants', () => {
    expect(calculateCrewBudget([])).toBeNull();
    expect(calculateCrewBudget([participant(1000, 3000), { active: true, budget: null }])).toBeNull();
    expect(calculateCrewBudget([participant(1000, 3000), participant(1, 1, false), { active: false, budget: null }])).toEqual({ submittedCount: 1, crewComfortCeiling: 1000, crewHardCeiling: 3000, currency: 'MYR' });
    expect(aggregateBudgetAffordability(100, [{ active: true, budget: null }])).toBeNull();
  });
  it.each([[500, 'comfortable'], [1000, 'comfortable'], [1500, 'stretch'], [3000, 'stretch'], [3000.01, 'infeasible']] as const)('classifies whole-trip cost %s as %s', (cost, status) => {
    expect(classifyAffordability(cost, calculateCrewBudget([participant(1000, 4000), participant(2000, 3000)])!)).toBe(status);
  });
  it.each([[1000, 0, 'comfortable'], [1250, 0.25, 'slight_stretch'], [1500, 0.5, 'stretch'], [1750, 0.75, 'stretch'], [1751, 0.751, 'near_limit'], [2000, 1, 'near_limit']] as const)('calculates and classifies strain at %s', (cost, strain, classification) => {
    const budget = participant(1000, 2000).budget;
    expect(calculateBudgetStrain(cost, budget)).toEqual({ strain, infeasible: false });
    expect(classifyBudgetStrain(cost, budget)).toBe(classification);
  });
  it('handles equal endpoints without division by zero', () => {
    const budget = participant(1000, 1000).budget;
    expect(calculateBudgetStrain(999, budget)).toEqual({ strain: 0, infeasible: false });
    expect(calculateBudgetStrain(1000, budget)).toEqual({ strain: 0, infeasible: false });
    expect(calculateBudgetStrain(1001, budget)).toEqual({ strain: null, infeasible: true });
    expect(classifyBudgetStrain(1001, budget)).toBe('infeasible');
  });
  it('exposes only anonymous counts and crew ceilings, never individual values or identities', () => {
    const people = [
      { ...participant(1000, 3000), memberId: 'sarah', displayName: 'Sarah' },
      { ...participant(2400, 3200), memberId: 'aina', displayName: 'Aina' },
      participant(1, 1, false),
    ];
    expect(aggregateBudgetAffordability(2000, people)).toEqual({ travellerCount: 2, comfortable: 1, stretching: 1, infeasible: 0 });
    expect(aggregateBudgetAffordability(3100, people)).toEqual({ travellerCount: 2, comfortable: 0, stretching: 1, infeasible: 1 });
    expect(Object.keys(calculateCrewBudget(people)!)).toEqual(['submittedCount', 'crewComfortCeiling', 'crewHardCeiling', 'currency']);
    const aggregate = JSON.stringify([calculateCrewBudget(people), aggregateBudgetAffordability(2000, people)]);
    for (const privateValue of ['sarah', 'Sarah', 'aina', 'Aina', '2400', '3200', 'comfortableBudgetMYR', 'maxBudgetMYR']) expect(aggregate).not.toContain(privateValue);
    expect(CrewBudgetSchema.safeParse({ ...calculateCrewBudget(people), memberId: 'sarah' }).success).toBe(false);
  });
  it.each([['', '3000'], ['1.5', '3000'], ['0', '3000'], ['3000', '2999'], ['1000001', '1000001'], ['Infinity', '3000']])('rejects invalid inputs %s / %s', (comfort, max) => {
    expect(parseBudgetInput(comfort, max).success).toBe(false);
  });
  it('enforces pair validation on the actual submission contract', () => {
    expect(QuestActionSchema.safeParse({ type: 'budget', comfortableBudgetMYR: 3000, maxBudgetMYR: 2000 }).success).toBe(false);
    expect(QuestActionSchema.safeParse({ type: 'budget', comfortableBudgetMYR: 2000, maxBudgetMYR: 3000, memberId: 'someone-else' }).success).toBe(false);
    expect(QuestActionSchema.safeParse({ type: 'budget', amount: 2000 }).success).toBe(false);
    expect(parseBudgetInput(' 2000 ', '3000').success).toBe(true);
  });
  it.each([NaN, Infinity, -1])('rejects invalid estimated cost %s', cost => {
    expect(() => calculateBudgetStrain(cost, participant(1000, 3000).budget)).toThrow();
  });
});
