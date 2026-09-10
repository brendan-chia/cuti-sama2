import { z } from 'zod';

export const DecisionKindSchema = z.enum(['dates', 'destination', 'budget']);
export type DecisionKind = z.infer<typeof DecisionKindSchema>;
export const DecisionValueSchema = z.object({
  destination: z.string().trim().min(1).max(120).optional(),
  startsOn: z.iso.date().optional(), endsOn: z.iso.date().optional(),
  amount: z.number().int().min(1).max(1_000_000).optional(),
}).strict();
export type DecisionValue = z.infer<typeof DecisionValueSchema>;
export const WorkspacePlaceSchema = z.object({
  id: z.uuid(), name: z.string().trim().min(1).max(160),
  location: z.string().trim().max(240), note: z.string().max(1200),
  day: z.number().int().min(1).max(30).nullable(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  sourceUrl: z.url().max(2000).refine(value => /^https?:\/\//i.test(value)).nullable(),
});
export type WorkspacePlace = z.infer<typeof WorkspacePlaceSchema>;
export const WorkspaceBookingSchema = z.object({
  id: z.uuid(), title: z.string().trim().min(1).max(160),
  kind: z.enum(['transport', 'stay']), status: z.enum(['selected', 'booked']),
  note: z.string().max(1200), cost: z.number().min(0).max(10_000_000).nullable(),
  url: z.url().max(2000).refine(value => /^https?:\/\//i.test(value)).nullable(),
});
export const WorkspaceSchema = z.object({
  tripId: z.uuid(), tripName: z.string(), travelParty: z.enum(['solo', 'group']),
  currentMemberId: z.uuid(), currentRole: z.enum(['organizer', 'member']),
  revision: z.number().int().nonnegative(), updatedAt: z.string(), needsReview: z.boolean(),
  legacyStarted: z.boolean(),
  members: z.array(z.object({ memberId: z.uuid(), name: z.string(), role: z.enum(['organizer', 'member']) })),
  decisions: z.array(z.object({
    kind: DecisionKindSchema, version: z.number().int().positive(),
    status: z.enum(['collecting', 'confirmed']), confirmed: DecisionValueSchema.nullable(),
    previous: DecisionValueSchema.nullable(),
    responses: z.array(z.object({ memberId: z.uuid(), abstain: z.boolean(), value: DecisionValueSchema.nullable() })),
  })),
  places: z.array(WorkspacePlaceSchema), bookings: z.array(WorkspaceBookingSchema),
});
export type Workspace = z.infer<typeof WorkspaceSchema>;
export type WorkspaceDecision = Workspace['decisions'][number];
export const WorkspaceActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('respond'), kind: DecisionKindSchema, value: DecisionValueSchema, abstain: z.boolean() }).strict(),
  z.object({ type: z.literal('confirm'), kind: DecisionKindSchema }).strict(),
  z.object({ type: z.literal('reopen'), kind: DecisionKindSchema }).strict(),
  z.object({ type: z.literal('place'), place: WorkspacePlaceSchema }).strict(),
  z.object({ type: z.literal('remove_place'), id: z.uuid() }).strict(),
  z.object({ type: z.literal('booking'), booking: WorkspaceBookingSchema }).strict(),
  z.object({ type: z.literal('remove_booking'), id: z.uuid() }).strict(),
  z.object({ type: z.literal('reviewed') }).strict(),
  z.object({ type: z.literal('build_draft'), days: z.number().int().min(1).max(30) }).strict(),
]);
export type WorkspaceAction = z.infer<typeof WorkspaceActionSchema>;

/** Private budgets are absent from other members' responses; confirmation is server-owned. */
export function responseSummary(decision: WorkspaceDecision, memberCount: number) {
  return decision.status === 'confirmed' ? 'Confirmed' : `${decision.responses.length} of ${memberCount} responded`;
}
export function decisionLabel(value: DecisionValue | null) {
  if (!value) return 'Not decided';
  if (value.destination) return value.destination;
  if (value.amount) return `RM ${value.amount.toLocaleString('en-MY')} per person · whole trip`;
  if (value.startsOn && value.endsOn) {
    const date = (v: string) => new Date(`${v}T12:00:00`).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${date(value.startsOn)} – ${date(value.endsOn)}`;
  }
  return 'Not decided';
}
