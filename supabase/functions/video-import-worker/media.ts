import { z } from 'zod';
export const MediaManifestSchema = z.object({
  items: z.array(z.object({ kind: z.enum(['image', 'video']), hasAudio: z.boolean() }).strict()).min(1).max(20),
  frames: z.array(z.object({ itemIndex: z.number().int().min(0).max(19), kind: z.enum(['image', 'video']), seconds: z.number().min(0).max(121) }).strict()).min(1).max(20),
}).strict().superRefine((manifest, ctx) => {
  manifest.items.forEach((item, index) => {
    const frames = manifest.frames.filter(f => f.itemIndex === index);
    if (!frames.length || (item.kind === 'image' && (item.hasAudio || frames.length !== 1 || frames[0].seconds !== 0))) ctx.addIssue({ code: 'custom', message: 'Every item needs valid visual evidence.' });
  });
  if (manifest.frames.some(f => manifest.items[f.itemIndex]?.kind !== f.kind)) ctx.addIssue({ code: 'custom', message: 'Frame item mismatch.' });
});
export function mediaEvidenceLabel(frame: z.infer<typeof MediaManifestSchema>['frames'][number]) {
  return frame.kind === 'image' ? `Photo ${frame.itemIndex + 1}` : `Video ${frame.itemIndex + 1} at ${frame.seconds.toFixed(3)}s`;
}
