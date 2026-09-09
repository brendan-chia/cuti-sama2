import { budgetFromOptions, costContext, priceBudgetOptions } from '../supabase/functions/_shared/budget-basis';
const transport = (cost: number, direction = 'arrival') => ({ label: 'Journey', reason: 'Practical route.', journey: { cost, direction, mode: 'flight', departureLocation: 'KUL', arrivalLocation: 'NRT' } });
const stay = (category: string, totalCost: number) => ({ category, reason: 'Near the selected stops.', stay: { name: `${category} hotel`, area: 'Tokyo', totalCost } });
const options = {
  arrival: { transport: [transport(1200), transport(800)], stays: [] },
  departure: { transport: [transport(400, 'departure')], stays: [] },
  stays: { transport: [], stays: [stay('cheap', 800), stay('mid-range', 1600), stay('expensive', 3200)] },
};
const room = { selectedCountryCode: 'JP', period: { startsOn: '2027-12-04', endsOn: '2027-12-08' }, members: [{}, {}], attractionIds: ['a', 'b'], currentMemberId: 'me', budgetSummary: { comfortablePerPerson: 2500 } };
const estimate = { accommodation: 800, returnTravel: 1200, food: 200, activities: 100, localTransport: 50, contingency: 150 };
it('builds a budget from both actual travel directions and the chosen tier for every night', () => {
  expect(budgetFromOptions(options, 2, 'comfortable')).toMatchObject({ returnTravel: 1200, accommodation: 800 });
  expect(budgetFromOptions(options, 1, 'premium')).toMatchObject({ returnTravel: 1200, accommodation: 3200 });
  expect(budgetFromOptions(options, 2, 'budget').accommodation).toBe(400);
  expect(() => budgetFromOptions({ ...options, departure: { transport: [], stays: [] } }, 2, 'budget')).toThrow(/Both outbound and return/);
});
it('handles day trips and rounds shared accommodation upwards', () => {
  expect(budgetFromOptions({ ...options, stays: { transport: [], stays: [] } }, 1, 'budget').accommodation).toBe(0);
  expect(budgetFromOptions(options, 3, 'comfortable').accommodation).toBe(534);
});
it('preserves prices and warns about alternatives only after reserving all other costs', () => {
  const priced = priceBudgetOptions(options.arrival, room, estimate, options);
  expect(priced.transport[0].journey.cost).toBe(1200);
  expect(priced.transport[0].reason).toContain('Above your planning budget by RM 400');
  expect(priced.transport[1].reason).not.toContain('Above');
  const stays = priceBudgetOptions(options.stays, room, estimate, options).stays;
  expect(stays[1].reason).not.toContain('Above');
  expect(stays[2].reason).toContain('Above your planning budget by RM 800');
});
it('replaces reserved transport with selected costs, without counting it twice', () => {
  const selectedRoom = { ...room, logistics: { selectedStayId: null, stays: [], transport: [ { memberId: 'me', direction: 'arrival', status: 'selected', cost: 1000 } ] } };
  expect(priceBudgetOptions(options.stays, selectedRoom, estimate, options).stays[1].reason).toContain('Above your planning budget by RM 200');
});
it('invalidates the saved basis when dates, places or traveller count change', () => {
  expect(costContext(room)).toBe(costContext({ ...room, attractionIds: ['b', 'a'] }));
  expect(costContext(room)).not.toBe(costContext({ ...room, members: [{}] }));
  expect(costContext(room)).not.toBe(costContext({ ...room, period: { ...room.period, endsOn: '2027-12-10' } }));
});
