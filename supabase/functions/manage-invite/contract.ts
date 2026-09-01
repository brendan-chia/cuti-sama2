import { z } from 'zod';
import { TokenSchema } from '../_shared/invites.ts';

export const ManageInvitePayloadSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('status'), tripId: z.uuid() }).strict(),
  z.object({
    action: z.enum(['issue', 'rotate']),
    tripId: z.uuid(),
    token: TokenSchema,
    idempotencyKey: z.uuid(),
  }).strict(),
  z.object({ action: z.literal('close'), tripId: z.uuid(), idempotencyKey: z.uuid() }).strict(),
]);
