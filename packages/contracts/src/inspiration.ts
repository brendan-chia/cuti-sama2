import { z } from 'zod';

// Conservative identity: keep identically named places in different locations separate.
export function deduplicateInspirationPlaces<T extends { name: string; location?: string; evidence: string }>(places: T[], evidenceLimit = 400): T[] {
  const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/&/g, ' and ').replace(/[\p{P}\p{Z}\s]+/gu, ' ').trim();
  const unique = new Map<string, T>();
  for (const place of places) {
    const key = JSON.stringify([normalize(place.name), normalize(place.location ?? '')]);
    const existing = unique.get(key);
    if (!existing) unique.set(key, { ...place });
    else if (!existing.evidence.includes(place.evidence)) {
      // Keep supporting evidence from both scenes when it fits, without inventing a quote.
      const combined = `${existing.evidence}\n${place.evidence}`;
      if (combined.length <= evidenceLimit) existing.evidence = combined;
    }
  }
  return [...unique.values()];
}

export function inspirationUrl(input: string) {
  const url = new URL(input.trim());
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !url.hostname.includes('.') || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/.test(url.hostname)) throw new Error('Use a public HTTPS post link.');
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid|igsh|igshid|si$)/i.test(key)) url.searchParams.delete(key);
  return url.toString();
}
export const InspirationInputSchema = z.object({
  sourceUrl: z.string().trim().min(1).max(2000).transform((value, ctx) => { try { return inspirationUrl(value); } catch { ctx.addIssue({ code: 'custom', message: 'Use a public HTTPS post link.' }); return z.NEVER; } }),
  folder: z.string().trim().min(1).max(60).default('Travel ideas'),
  caption: z.string().trim().max(6000).default(''),
}).strict();
export const InspirationAnalysisSchema = z.object({
  title: z.string().min(1).max(120), summary: z.string().max(1600),
  places: z.array(z.object({ name: z.string().min(1).max(150), location: z.string().max(150), evidence: z.string().min(1).max(400) }).strict()).max(12),
  tags: z.array(z.string().min(1).max(50)).max(10),
  planningNotes: z.array(z.string().max(400)).max(10),
}).strict();
export type InspirationAnalysis = z.infer<typeof InspirationAnalysisSchema>;
export const InspirationSchema = z.object({
  id: z.uuid(), source_url: z.string(), folder: z.string(), caption: z.string(),
  status: z.enum(['saved', 'analyzing', 'ready', 'needs_input', 'failed']),
  analysis: InspirationAnalysisSchema.transform(analysis => ({ ...analysis, places: deduplicateInspirationPlaces(analysis.places) })).nullable(), message: z.string(),
  source_text: z.string(), provider: z.string().nullable(), model: z.string().nullable(),
  created_at: z.string(), updated_at: z.string(),
});
export type Inspiration = z.infer<typeof InspirationSchema>;
