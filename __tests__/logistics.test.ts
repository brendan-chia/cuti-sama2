import { emptyLogistics, LogisticsSchema, logisticsTotals, StaySchema, TransportSchema, type Logistics, type Transport } from '../packages/contracts/src/logistics';

const memberId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const transport: Transport = { direction: 'arrival', mode: 'flight', departureLocation: 'KUL', arrivalLocation: 'NRT', departureAt: '2027-10-12T07:00:00+08:00', arrivalAt: '2027-10-12T14:30:00+09:00', cost: 850, bookingLink: null, status: 'selected' };
const stay = { id: '33333333-3333-4333-8333-333333333333', name: 'Crew stay', area: 'Shinjuku', image: 'https://example.com/hotel.jpg', latitude: 35.7, longitude: 139.7, totalCost: 1050, checkIn: '2027-10-12', checkOut: '2027-10-16', rating: 8.4, distance: '6 min from station', bookingLink: 'https://example.com/book', provider: 'Provider' };

it('validates offsets, chronology, supported modes and safe provider links', () => {
  expect(TransportSchema.safeParse(transport).success).toBe(true);
  for (const change of [{ mode: 'ferry' }, { cost: -1 }, { bookingLink: 'javascript:alert(1)' }, { arrivalAt: '2027-10-12T14:30:00' }, { arrivalAt: '2027-10-12T07:30:00+09:00' }]) {
    expect(TransportSchema.safeParse({ ...transport, ...change }).success).toBe(false);
  }
  expect(StaySchema.safeParse({ ...stay, checkOut: stay.checkIn }).success).toBe(false);
  expect(StaySchema.safeParse({ ...stay, image: 'file:///secret' }).success).toBe(false);
});

it('deducts selected costs per traveller and uses the lowest remaining budget', () => {
  const logistics: Logistics = { ...emptyLogistics, stays: [stay], selectedStayId: stay.id, transport: [
    { ...transport, memberId }, { ...transport, memberId: otherId, cost: 1000 },
    { ...transport, memberId, direction: 'departure', cost: 400, status: 'proposed' },
  ] };
  expect(LogisticsSchema.safeParse(logistics).success).toBe(true);
  const result = logisticsTotals(logistics, [memberId, otherId], 3000);
  expect(result.stayPerPerson).toBe(525);
  expect(result.members[0].remaining).toBe(1625);
  expect(result.remaining).toBe(1475);
  expect(result.averageTransport).toBe(925);
  expect(result.draft).toBe(true);
  // Removed travellers no longer affect costs or the equal stay split.
  expect(logisticsTotals(logistics, [memberId], 3000).remaining).toBe(1100);
});

it('keeps unknown costs provisional and flags over-budget selected logistics', () => {
  expect(logisticsTotals(emptyLogistics, [memberId], 3000)).toMatchObject({ draft: true, remaining: 3000 });
  const logistics = { ...emptyLogistics, stays: [stay], selectedStayId: stay.id, transport: [
    { ...transport, memberId }, { ...transport, memberId, direction: 'departure' as const },
  ] };
  expect(logisticsTotals(logistics, [memberId], 2000)).toMatchObject({ draft: false, remaining: -750 });
});
