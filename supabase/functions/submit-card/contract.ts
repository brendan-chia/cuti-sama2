import { z } from 'zod';
export const SubmitCardPayloadSchema = z.object({ tripId: z.uuid(), roundId: z.uuid(), value: z.string().trim().min(1).max(240), idempotencyKey: z.uuid() }).strict();
