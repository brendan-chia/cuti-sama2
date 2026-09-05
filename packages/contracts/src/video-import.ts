import { z } from 'zod';
import { PlaceCandidateSchema } from './place-import';
export const VideoImportStatusSchema=z.object({
  importId:z.uuid(), state:z.enum(['uploading','queued','running','done','failed','cancelled']),
  processedFrames:z.number().int().nonnegative(), totalFrames:z.number().int().nonnegative(),
  audioDone:z.boolean(), message:z.string(), workerOnline:z.boolean(), candidates:z.array(PlaceCandidateSchema).max(12),
}).strict();
export type VideoImportStatus=z.infer<typeof VideoImportStatusSchema>;
