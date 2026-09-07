type Purpose = 'structured' | 'itinerary' | 'vision';
export const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
export function llmConfig(purpose: Purpose = 'structured') {
  const base = Deno.env.get('GROQ_STRUCTURED_OUTPUT_MODEL') || 'openai/gpt-oss-20b';
  const model = purpose === 'vision' ? Deno.env.get('GROQ_VISION_MODEL') || 'qwen/qwen3.6-27b'
    : purpose === 'itinerary' ? Deno.env.get('GROQ_ITINERARY_MODEL') || base : base;
  return { provider: 'groq' as const, apiKey: Deno.env.get('GROQ_API_KEY'), model, endpoint: GROQ_ENDPOINT };
}
export function llmFetch(fetcher: typeof fetch = fetch): typeof fetch {
  return ((url: RequestInfo | URL, init?: RequestInit) => {
    if (String(url) !== GROQ_ENDPOINT) throw new Error('AI requests must use the official Groq endpoint.');
    return fetcher(url, init);
  }) as typeof fetch;
}
