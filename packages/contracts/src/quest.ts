import { z } from 'zod';
import { ConfirmedPlaceSchema } from './place-import';

export const QuestStageSchema = z.enum(['timing', 'picks', 'voting', 'explore', 'budget', 'complete']);
export type QuestStage = z.infer<typeof QuestStageSchema>;

export const AvailabilitySchema = z.object({ startsOn: z.iso.date(), endsOn: z.iso.date() }).strict();
export const TripPeriodSchema = AvailabilitySchema.extend({
  label: z.string().trim().min(1).max(120),
  reason: z.string().trim().min(1).max(1200),
}).strict();
export type TripPeriod = z.infer<typeof TripPeriodSchema>;

export const QuestCountryCodeSchema = z.enum([
  'MY', 'TH', 'ID', 'VN', 'JP', 'KR', 'SG', 'TW', 'PH', 'KH', 'LA', 'IN',
  'LK', 'NP', 'AU', 'NZ', 'GB', 'FR', 'IT', 'ES', 'TR', 'AE', 'US', 'CA',
]);
export type QuestCountryCode = z.infer<typeof QuestCountryCodeSchema>;
const CountryPicksSchema = z.array(QuestCountryCodeSchema).min(1).max(3)
  .refine((codes) => new Set(codes).size === codes.length, 'Choose each country only once.');

export const QuestActionSchema = z.discriminatedUnion('type', [
  AvailabilitySchema.extend({ type: z.literal('availability') }).strict(),
  z.object({ type: z.literal('period'), period: TripPeriodSchema }).strict(),
  z.object({ type: z.literal('picks'), countryCodes: CountryPicksSchema }).strict(),
  z.object({ type: z.literal('vote'), countryCode: QuestCountryCodeSchema, agree: z.boolean() }).strict(),
  z.object({ type: z.literal('resolve_tie'), countryCode: QuestCountryCodeSchema }).strict(),
  z.object({ type: z.literal('restart_picks') }).strict(),
  z.object({ type: z.literal('attractions'), attractionIds: z.array(z.string().min(1).max(120)).min(1).max(20)
    .refine((ids) => new Set(ids).size === ids.length, 'Choose each attraction only once.') }).strict(),
  z.object({ type: z.literal('budget'), amount: z.number().int().min(1).max(1_000_000) }).strict(),
  z.object({ type: z.literal('finish') }).strict(),
]);
export type QuestAction = z.infer<typeof QuestActionSchema>;

export const QuestRoomSchema = z.object({
  tripId: z.uuid(),
  tripName: z.string().min(2).max(80),
  currentMemberId: z.uuid(),
  currentRole: z.enum(['organizer', 'member']),
  stage: QuestStageSchema,
  revision: z.number().int().nonnegative(),
  members: z.array(z.object({
    memberId: z.uuid(), displayName: z.string(),
    availabilitySubmitted: z.boolean(), picksSubmitted: z.boolean(),
    votesSubmitted: z.boolean(), budgetSubmitted: z.boolean(),
  }).strict()).min(1).max(8),
  dateProposals: z.array(AvailabilitySchema.extend({ memberId: z.uuid() }).strict()).max(8).optional(),
  ownAvailability: AvailabilitySchema.nullable(),
  sharedAvailability: AvailabilitySchema.nullable(),
  period: TripPeriodSchema.nullable(),
  ownPicks: z.array(QuestCountryCodeSchema).max(3),
  countries: z.array(QuestCountryCodeSchema).max(24),
  ownVotes: z.record(z.string(), z.boolean()),
  results: z.array(z.object({ countryCode: QuestCountryCodeSchema, agreeCount: z.number().int().nonnegative() }).strict()),
  tiedCountryCodes: z.array(QuestCountryCodeSchema),
  selectedCountryCode: QuestCountryCodeSchema.nullable(),
  attractionIds: z.array(z.string()),
  importedPlaces: z.array(ConfirmedPlaceSchema).optional(),
  ownBudget: z.number().int().positive().nullable(),
  budgetSummary: z.object({
    submittedCount: z.number().int().nonnegative(), comfortablePerPerson: z.number().int().positive(),
    currency: z.literal('MYR'),
  }).strict().nullable(),
}).strict();
export type QuestRoom = z.infer<typeof QuestRoomSchema>;
