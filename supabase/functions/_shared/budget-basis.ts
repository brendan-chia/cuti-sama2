type LogisticsContext = { selectedCountryCode: string; period: { startsOn: string; endsOn: string }; members: unknown[]; attractionIds: string[]; importedPlaces?: { id: string }[]; budgetSummary?: { crewHardCeiling: number } | null };
type Options = { transport: { label: string; reason: string; journey: { cost: number; direction: string; mode: string; departureLocation: string; arrivalLocation: string } }[]; stays: { category?: string; reason: string; stay: { name: string; area: string; totalCost: number } }[] };
type Estimate = { accommodation: number; returnTravel: number; food: number; activities: number; localTransport: number; contingency: number };
export function costContext(room: LogisticsContext) {
  return JSON.stringify([room.selectedCountryCode, room.period.startsOn, room.period.endsOn, room.members.length, [...room.attractionIds].sort(), (room.importedPlaces ?? []).filter(p => room.attractionIds.includes(p.id)).sort((a,b) => a.id.localeCompare(b.id))]);
}
export function budgetFromOptions(options: { arrival: Options; departure: Options; stays: Options }, count: number, style: string) {
  if (count < 1 || !options.arrival.transport.length || !options.departure.transport.length) throw new Error('Both outbound and return travel estimates are required.');
  const arrival = [...options.arrival.transport].sort((a,b) => a.journey.cost - b.journey.cost)[0];
  const departure = [...options.departure.transport].sort((a,b) => a.journey.cost - b.journey.cost)[0];
  const category = style === 'budget' ? 'cheap' : style === 'premium' ? 'expensive' : 'mid-range';
  const stay = options.stays.stays.find(item => item.category === category);
  if (options.stays.stays.length && !stay) throw new Error('The requested accommodation tier is missing.');
  return {
    returnTravel: Math.ceil(arrival.journey.cost + departure.journey.cost),
    accommodation: Math.ceil((stay?.stay.totalCost ?? 0) / count),
    assumptions: [
      `Outbound: ${arrival.journey.departureLocation} to ${arrival.journey.arrivalLocation}, ${arrival.journey.mode}, RM ${arrival.journey.cost} per person.`,
      `Return: ${departure.journey.departureLocation} to ${departure.journey.arrivalLocation}, ${departure.journey.mode}, RM ${departure.journey.cost} per person.`,
      stay ? `Stay: ${stay.stay.name}, ${stay.stay.area}, ${category}; RM ${stay.stay.totalCost} for ${count === 1 ? 'you' : `${count} travellers`} and all nights. Other tiers may cost more.` : 'No overnight accommodation is needed.',
    ].map(text => text.slice(0, 500)),
  };
}
export function priceBudgetOptions(options: Options, room: LogisticsContext & { currentMemberId?: string; logistics?: { selectedStayId: string | null; stays: { id: string; totalCost: number }[]; transport: { memberId: string; direction: string; status: string; cost: number }[] } }, estimate?: Estimate, reference?: { arrival: Options; departure: Options }) {
  const ceiling = room.budgetSummary?.crewHardCeiling ?? 0;
  const reserve = estimate ? estimate.food + estimate.activities + estimate.localTransport + estimate.contingency : ceiling * 0.3;
  const selectedStay = room.logistics?.stays.find(s => s.id === room.logistics?.selectedStayId);
  const stayCost = selectedStay ? selectedStay.totalCost / room.members.length : estimate?.accommodation ?? ceiling * 0.3;
  const journeys = room.logistics?.transport.filter(t => t.memberId === room.currentMemberId && t.status !== 'proposed') ?? [];
  const reservedJourney = (direction: string) => {
    const candidates = direction === 'arrival' ? reference?.arrival.transport : reference?.departure.transport;
    return candidates?.length ? Math.min(...candidates.map(t => t.journey.cost)) : (estimate?.returnTravel ?? ceiling * 0.4) / 2;
  };
  const travelCost = ['arrival', 'departure'].reduce((sum, direction) => sum + (journeys.find(t => t.direction === direction)?.cost ?? reservedJourney(direction)), 0);
  const warning = (cost: number) => cost > ceiling ? ` Above your planning budget by RM ${Math.ceil(cost - ceiling)} after reserving other trip costs. Choose a cheaper option or increase your budget.` : '';
  return {
    transport: options.transport.map(item => ({ ...item, reason: (item.reason + warning(item.journey.cost + (journeys.find(t => t.direction !== item.journey.direction)?.cost ?? reservedJourney(item.journey.direction === 'arrival' ? 'departure' : 'arrival')) + stayCost + reserve)).slice(-500) })),
    stays: options.stays.map(item => ({ ...item, reason: (item.reason + warning(item.stay.totalCost / room.members.length + travelCost + reserve)).slice(-500) })),
  };
}
