import { BudgetEstimateSchema, budgetTotal } from '../packages/contracts/src/budget-recommendation';

const estimate = { accommodation: 700, food: 300, localTransport: 100, activities: 200, returnTravel: 900, contingency: 220, assumptions: ['Five days, four nights; estimated return travel from Kuala Lumpur.'] };
test('whole-trip total includes return travel and contingency exactly once', () => {
  expect(budgetTotal(BudgetEstimateSchema.parse(estimate))).toBe(2420);
});
test.each([
  { ...estimate, food: -1 },
  { ...estimate, accommodation: 1.5 },
  { ...estimate, returnTravel: undefined },
  { ...estimate, assumptions: [] },
  { ...estimate, accommodation: 500000, food: 500000 },
  { ...estimate, accommodation: 0, food: 0, localTransport: 0, activities: 0, returnTravel: 0, contingency: 0 },
])('rejects incomplete or invalid AI cost estimates', (invalid) => {
  expect(BudgetEstimateSchema.safeParse(invalid).success).toBe(false);
});
