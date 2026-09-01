import { z } from 'zod';

export const LockConstraintsPayloadSchema = z.object({ tripId: z.uuid() }).strict();
