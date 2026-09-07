import { z } from 'zod';
import { StaySchema, TransportSchema } from './logistics';

export const LogisticsRecommendationsSchema = z.object({
  transport: z.array(z.object({ label: z.string().min(1).max(160), reason: z.string().min(1).max(500), journey: TransportSchema }).strict()).max(3),
  stays: z.array(z.object({ reason: z.string().min(1).max(500), stay: StaySchema }).strict()).max(3),
}).strict();
export type LogisticsRecommendations = z.infer<typeof LogisticsRecommendationsSchema>;
