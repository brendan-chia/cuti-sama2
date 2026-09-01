import { z } from 'zod';

export type EvidenceStatus = 'verified' | 'estimated' | 'unavailable';
export type Provenance = { status: EvidenceStatus; label: string; sourceLabel: string | null; sourceUrl: string | null; observedAt: string | null; stale: boolean };
const STALE_AFTER_MS = 90 * 24 * 60 * 60 * 1_000;

export function provenance(input: { status: EvidenceStatus; field: string; sourceLabel?: string | null; sourceUrl?: string | null; observedAt?: string | null }, asOf: Date): Provenance {
  const stale = input.status !== 'verified' || !input.observedAt || asOf.getTime() - new Date(input.observedAt).getTime() > STALE_AFTER_MS;
  const qualifier = input.status === 'unavailable' ? 'Unavailable' : input.status === 'estimated' ? 'Estimated' : stale ? 'Verified · may be outdated' : 'Verified';
  return { status: input.status, label: `${input.field}: ${qualifier}`, sourceLabel: input.sourceLabel ?? null, sourceUrl: input.sourceUrl ?? null, observedAt: input.observedAt ?? null, stale };
}

const AiAnnotationsSchema = z.object({
  destinations: z.array(z.object({ destinationId: z.string().min(1).max(160), reasonOrder: z.array(z.number().int().nonnegative()).max(8) }).strict()).max(5),
}).strict();

export function validateDestinationAnnotations(value: unknown, allowed: ReadonlyMap<string, number>) {
  const parsed = AiAnnotationsSchema.safeParse(value);
  if (!parsed.success) return null;
  const seen = new Set<string>();
  for (const annotation of parsed.data.destinations) {
    const reasonCount = allowed.get(annotation.destinationId);
    if (reasonCount === undefined || seen.has(annotation.destinationId)) return null;
    if (annotation.reasonOrder.length !== reasonCount || new Set(annotation.reasonOrder).size !== annotation.reasonOrder.length || annotation.reasonOrder.some((index) => index >= reasonCount)) return null;
    seen.add(annotation.destinationId);
  }
  return parsed.data;
}

export async function requestDestinationAnnotations(cards: { destinationId: string; matchReasons: string[] }[], options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}) {
  const apiKey = Deno.env.get('GROQ_API_KEY'); const model = Deno.env.get('GROQ_STRUCTURED_OUTPUT_MODEL');
  if (!apiKey || !model || cards.length === 0) return null;
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 4_000);
  try {
    const response = await (options.fetchImpl ?? fetch)('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, temperature: 0,
        response_format: { type: 'json_schema', json_schema: { name: 'destination_reason_order', strict: true, schema: { type: 'object', additionalProperties: false, required: ['destinations'], properties: { destinations: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['destinationId', 'reasonOrder'], properties: { destinationId: { type: 'string' }, reasonOrder: { type: 'array', items: { type: 'integer', minimum: 0 } } } } } } } },
        messages: [
          { role: 'system', content: 'You may only reorder supplied reason indexes for supplied destination IDs. Never add a destination, reason, fact, certainty claim, or eligibility decision.' },
          { role: 'user', content: JSON.stringify({ destinations: cards }) },
        ],
      }),
    });
    if (!response.ok) return null;
    const body = await response.json() as { choices?: { message?: { content?: string } }[] };
    const content = body.choices?.[0]?.message?.content; if (!content) return null;
    return validateDestinationAnnotations(JSON.parse(content), new Map(cards.map((card) => [card.destinationId, card.matchReasons.length])));
  } catch { return null; } finally { clearTimeout(timeout); }
}
