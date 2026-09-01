import { z } from 'zod';

import { PlanningModeSchema } from './trip';

export const InviteTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, 'Invitation token is invalid.');

export const InviteContextSchema = z.object({
  tripName: z.string().min(2).max(80),
  mode: PlanningModeSchema,
  organizerName: z.string().min(1).max(50),
  expiresAt: z.iso.datetime(),
});

export type InviteContext = z.infer<typeof InviteContextSchema>;

export const InvitationStatusSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('never_issued') }),
  z.object({ status: z.literal('closed') }),
  z.object({
    status: z.literal('open'),
    inviteId: z.uuid(),
    expiresAt: z.iso.datetime(),
  }),
]);

export type InvitationStatus = z.infer<typeof InvitationStatusSchema>;

export const IssuedInvitationSchema = z.object({
  status: z.literal('open'),
  inviteId: z.uuid(),
  token: InviteTokenSchema,
  inviteUrl: z.url().refine((value) => value.startsWith('https://'), 'Invitation URL must use HTTPS.'),
  expiresAt: z.iso.datetime(),
});

export type IssuedInvitation = z.infer<typeof IssuedInvitationSchema>;

export const DisplayNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter a display name.')
  .max(50, 'Display name must be 50 characters or fewer.');

export const JoinTripResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('confirmation_required'),
    displayName: DisplayNameSchema,
    discriminator: z.number().int().min(2),
  }),
  z.object({
    status: z.literal('joined'),
    tripId: z.uuid(),
    memberId: z.uuid(),
    tripName: z.string(),
    displayName: DisplayNameSchema,
    discriminator: z.number().int().min(1),
  }),
]);

export type JoinTripResult = z.infer<typeof JoinTripResultSchema>;

export const CachedInvitationSchema = IssuedInvitationSchema.pick({
  inviteId: true,
  token: true,
  inviteUrl: true,
  expiresAt: true,
});

export type CachedInvitation = z.infer<typeof CachedInvitationSchema>;
