import { z } from 'zod';
export const ManageRoundPayloadSchema = z.object({ tripId: z.uuid(), action: z.enum(['start', 'close', 'advance']), idempotencyKey: z.uuid() }).strict();
