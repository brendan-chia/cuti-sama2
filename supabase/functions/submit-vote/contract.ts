import { z } from 'zod';
export const SubmitVotePayloadSchema = z.object({ tripId: z.uuid(), roundId: z.uuid(), optionId: z.string().min(1).max(200), idempotencyKey: z.uuid() }).strict();
