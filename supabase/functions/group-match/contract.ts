import { z } from 'zod';

export const GroupMatchPayloadSchema = z.object({ tripId: z.uuid() }).strict();

