import { z } from 'zod';

export const AiWordingSchema = z.object({
  heading: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(500),
  facts: z.array(z.object({
    factId: z.string().regex(/^[a-z0-9][a-z0-9:_-]*$/),
    wording: z.string().trim().min(1).max(500),
  }).strict()).max(100),
}).strict();

export type AiWording = z.infer<typeof AiWordingSchema>;

export function validateAiWording(value: unknown, supportedFactIds: readonly string[]): AiWording | null {
  const parsed = AiWordingSchema.safeParse(value);
  if (!parsed.success) return null;
  const supported = new Set(supportedFactIds);
  const seen = new Set<string>();
  for (const fact of parsed.data.facts) {
    if (!supported.has(fact.factId) || seen.has(fact.factId)) return null;
    seen.add(fact.factId);
  }
  return parsed.data;
}

