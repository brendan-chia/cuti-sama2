import { z } from 'zod';

export const PlaceCandidateSchema = z.object({
  id: z.string().min(1).max(150), name: z.string().min(1).max(200),
  address: z.string().max(500), countryCode: z.string().regex(/^[A-Z]{2}$/),
  latitude: z.number().min(-85).max(85), longitude: z.number().min(-180).max(180),
  evidence: z.string().max(500), sourceUrl: z.url().max(2000),
}).strict();
export type PlaceCandidate = z.infer<typeof PlaceCandidateSchema>;
export const ConfirmedPlaceSchema = PlaceCandidateSchema.extend({
  confirmedBy: z.uuid(), sourcePost: z.string().max(2000).nullable(),
});
export type ConfirmedPlace = z.infer<typeof ConfirmedPlaceSchema>;

export const PlaceImportRequestSchema = z.object({
  tripId: z.uuid(), requestId: z.uuid(),
  sourceUrl: z.string().trim().max(2000).default(''),
  text: z.string().trim().max(6000).default(''),
  inspirationId: z.uuid().optional(),
  image: z.string().max(4_000_000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/).optional(),
}).strict().refine((value) => Boolean(value.sourceUrl || value.text || value.image || value.inspirationId), 'Add a link, caption, or screenshot.');

export const PlaceImportResultSchema = z.object({
  importId: z.uuid(), candidates: z.array(PlaceCandidateSchema).max(12),
  message: z.string(), status: z.enum(['ready', 'needs_input']),
}).strict();
export type PlaceImportResult = z.infer<typeof PlaceImportResultSchema>;

const socialHosts = new Set(['tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com', 'instagram.com', 'www.instagram.com', 'youtube.com', 'www.youtube.com', 'youtu.be']);
export function normalizeSocialUrl(input: string): string {
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !socialHosts.has(url.hostname)) {
    throw new Error('Use a TikTok, Instagram, or YouTube HTTPS link. You can also paste a caption.');
  }
  url.hash = '';
  const video = url.searchParams.get('v');
  const imageIndex = url.searchParams.get('img_index');
  url.search = '';
  if (url.pathname === '/watch' && video) url.searchParams.set('v', video);
  if (['instagram.com', 'www.instagram.com'].includes(url.hostname) && imageIndex && /^[1-9]\d?$/.test(imageIndex)) url.searchParams.set('img_index', imageIndex);
  return url.toString();
}
