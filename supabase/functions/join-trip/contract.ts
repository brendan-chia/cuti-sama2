import { z } from 'zod';
import { TokenSchema } from '../_shared/invites.ts';

export const JoinTripPayloadSchema = z.object({
  token: TokenSchema,
  displayName: z.string().trim().min(1).max(50),
  confirmDuplicate: z.boolean(),
  idempotencyKey: z.uuid(),
});
