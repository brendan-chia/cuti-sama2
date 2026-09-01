import { z } from 'zod';
export const CloseVotePayloadSchema = z.object({ tripId: z.uuid(), action: z.enum(['start', 'close', 'second_vote', 'constraint_comparison']), idempotencyKey: z.uuid() }).strict();
