import { z } from 'zod';
import { PlaceCandidateSchema } from './place-import';
export const ExploreSuggestionRequestSchema = z.object({ tripId: z.uuid(), selectedIds: z.array(z.string().min(1).max(150)).max(20) }).strict();
export const ExploreSuggestionsSchema = z.object({
  importId: z.uuid().optional(),
  places: z.array(z.object({ id: z.string(), reason: z.string().max(400), candidate: PlaceCandidateSchema.optional() }).strict()).max(5),
}).strict();
