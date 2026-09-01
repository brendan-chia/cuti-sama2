import { z } from 'zod';
export const LockDestinationPayloadSchema = z.object({ tripId: z.uuid(), optionId: z.string().min(1).max(200), action: z.enum(['lock', 'unlock']), idempotencyKey: z.uuid() }).strict();
