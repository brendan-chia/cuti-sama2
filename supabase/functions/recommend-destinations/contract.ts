import { z } from 'zod';
export const RecommendDestinationsPayloadSchema = z.object({ tripId: z.uuid() }).strict();

