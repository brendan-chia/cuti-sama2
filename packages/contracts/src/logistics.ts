import { z } from 'zod';

const text = z.string().trim().min(1).max(240);
const url = z.url().max(2000).refine((value) => /^https?:\/\//i.test(value), 'Use an http or https link.');
const cost = z.number().finite().min(0).max(1_000_000);
export const TransportSchema = z.object({
  direction: z.enum(['arrival', 'departure']), mode: z.enum(['flight', 'train', 'bus', 'car']),
  departureLocation: text, arrivalLocation: text,
  departureAt: z.iso.datetime({ offset: true }), arrivalAt: z.iso.datetime({ offset: true }),
  cost, bookingLink: url.nullable(), status: z.enum(['proposed', 'selected', 'booked']),
}).strict().refine((item) => Date.parse(item.arrivalAt) > Date.parse(item.departureAt), 'Arrival must be after departure, accounting for time zones.');
export type Transport = z.infer<typeof TransportSchema>;
export const StaySchema = z.object({
  id: z.uuid(), name: text, area: text, image: url,
  latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180),
  totalCost: cost, checkIn: z.iso.date(), checkOut: z.iso.date(),
  rating: z.number().min(0).max(10), distance: text, bookingLink: url, provider: text,
}).strict().refine((stay) => stay.checkOut > stay.checkIn, 'Check-out must follow check-in.');
export type Stay = z.infer<typeof StaySchema>;
export const LogisticsSchema = z.object({
  transport: z.array(TransportSchema.safeExtend({ memberId: z.uuid() })).max(16),
  stays: z.array(StaySchema).max(20),
  votes: z.array(z.object({ memberId: z.uuid(), stayId: z.uuid() }).strict()).max(8),
  selectedStayId: z.uuid().nullable(), skippedMemberIds: z.array(z.uuid()).max(8),
  staySkipped: z.boolean(),
}).strict();
export type Logistics = z.infer<typeof LogisticsSchema>;
export const emptyLogistics: Logistics = { transport: [], stays: [], votes: [], selectedStayId: null, skippedMemberIds: [], staySkipped: false };
export const logisticsDraftNotice = 'Schedule may change once transport and accommodation are confirmed.';

export function logisticsTotals(logistics: Logistics, memberIds: string[], ceiling: number) {
  const transport = logistics.transport.filter((item) => memberIds.includes(item.memberId) && item.status !== 'proposed');
  const stay = logistics.stays.find((item) => item.id === logistics.selectedStayId) ?? null;
  const stayPerPerson = stay ? Math.ceil(stay.totalCost * 100 / memberIds.length) / 100 : 0;
  const members = memberIds.map((memberId) => {
    const journeys = transport.filter((item) => item.memberId === memberId);
    const transportCost = journeys.reduce((sum, item) => sum + item.cost, 0);
    return { memberId, transportCost, remaining: Math.floor((ceiling - transportCost - stayPerPerson) * 100) / 100 };
  });
  return { stay, stayPerPerson, members,
    averageTransport: members.reduce((sum, item) => sum + item.transportCost, 0) / memberIds.length,
    remaining: Math.min(...members.map((item) => item.remaining)),
    draft: !stay || memberIds.some((id) => ['arrival', 'departure'].some((direction) => !transport.some((item) => item.memberId === id && item.direction === direction))),
  };
}
