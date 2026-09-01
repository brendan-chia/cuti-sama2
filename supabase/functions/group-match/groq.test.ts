import { requestGroqWording } from '../_shared/groq.ts';

function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }
const facts = [{ factId: 'agreement:vibe:quiet', kind: 'agreement', title: 'Common preference', detail: 'Quiet beach' }];

Deno.test('invalid Groq JSON/schema is recoverable', async () => {
  Deno.env.set('GROQ_API_KEY', 'test'); Deno.env.set('GROQ_STRUCTURED_OUTPUT_MODEL', 'test-model');
  const malformed = await requestGroqWording(facts, { fetchImpl: (() => Promise.resolve(new Response('{"choices":[{"message":{"content":"not-json"}}]}'))) as typeof fetch });
  assert(malformed === null, 'malformed output should fall back');
  const unknown = await requestGroqWording(facts, { fetchImpl: (() => Promise.resolve(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ heading: 'Book Bali', summary: 'Invented', facts: [{ factId: 'invented:bali', wording: 'Book it' }] }) } }] })))) as typeof fetch });
  assert(unknown === null, 'unsupported output should fall back');
});

Deno.test('Groq timeout is recoverable', async () => {
  Deno.env.set('GROQ_API_KEY', 'test'); Deno.env.set('GROQ_STRUCTURED_OUTPUT_MODEL', 'test-model');
  const hangingFetch = ((_: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))) as typeof fetch;
  const value = await requestGroqWording(facts, { fetchImpl: hangingFetch, timeoutMs: 1 });
  assert(value === null, 'timeout should fall back');
});

