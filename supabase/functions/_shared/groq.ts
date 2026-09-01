import { validateGroqWording, type GroqWording } from './ai-validation.ts';

type DeterministicFact = { factId: string; kind: string; title: string; detail: string };

export async function requestGroqWording(
  facts: readonly DeterministicFact[],
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<GroqWording | null> {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  const model = Deno.env.get('GROQ_STRUCTURED_OUTPUT_MODEL');
  if (!apiKey || !model || facts.length === 0) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 4_000);
  try {
    const response = await (options.fetchImpl ?? fetch)('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'group_match_wording', strict: true,
            schema: {
              type: 'object', additionalProperties: false, required: ['heading', 'summary', 'facts'],
              properties: {
                heading: { type: 'string', maxLength: 120 }, summary: { type: 'string', maxLength: 500 },
                facts: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['factId', 'wording'], properties: { factId: { type: 'string' }, wording: { type: 'string', maxLength: 500 } } } },
              },
            },
          },
        },
        messages: [
          { role: 'system', content: 'Rewrite only the supplied deterministic facts. Do not add recommendations, destinations, conclusions, people, or facts. Keep every factId unchanged.' },
          { role: 'user', content: JSON.stringify({ facts }) },
        ],
      }),
    });
    if (!response.ok) return null;
    const body = await response.json() as { choices?: { message?: { content?: string } }[] };
    const content = body.choices?.[0]?.message?.content;
    if (!content) return null;
    return validateGroqWording(JSON.parse(content), facts.map((fact) => fact.factId));
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

