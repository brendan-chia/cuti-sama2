import { asTripPeriod, buildTripPeriodCandidates } from '../../../packages/contracts/src/trip-period.ts';
import { requestAiTripPeriods } from './groq.ts';

const candidates = buildTripPeriodCandidates({ startsOn: '2026-10-01', endsOn: '2026-12-01' }, 5, '2026-09-05');
const options = { apiKey: 'test', model: 'test-model' };
function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }
function aiResponse(value: unknown) {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] }));
}

Deno.test('only exact candidate IDs become trip periods', async () => {
  const chosen = candidates.slice(0, 3).reverse();
  let sentData = '';
  const valid = await requestAiTripPeriods(candidates, {
    ...options,
    fetchImpl: ((_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      sentData = body.messages[1].content;
      return Promise.resolve(aiResponse({ periodIds: chosen.map((period) => period.id) }));
    }) as typeof fetch,
  });
  assert(JSON.stringify(valid) === JSON.stringify(chosen.map(asTripPeriod)), 'model selection must retain calendar facts');
  const sent = JSON.parse(sentData);
  assert(Object.keys(sent).join(',') === 'count,weekendDefinition,candidates', 'only aggregated calendar candidates may be sent');
  assert(!sentData.includes('memberId'), 'member identities must not be sent');
});

Deno.test('invalid, invented, or duplicated AI output falls back', async () => {
  for (const output of [
    { periodIds: ['invented', candidates[1].id, candidates[2].id] },
    { periodIds: [candidates[0].id, candidates[0].id, candidates[2].id] },
    { periodIds: candidates.slice(0, 3).map((candidate) => candidate.id), reason: 'Guaranteed sunshine.' },
  ]) {
    const result = await requestAiTripPeriods(candidates, { ...options, fetchImpl: (() => Promise.resolve(aiResponse(output))) as typeof fetch });
    assert(result === null, 'invalid provider output must not be shown');
  }
  const malformed = await requestAiTripPeriods(candidates, { ...options, fetchImpl: (() => Promise.resolve(new Response('not-json'))) as typeof fetch });
  assert(malformed === null, 'invalid JSON must fall back');
});

Deno.test('provider errors, missing config, and timeout allow calendar fallback', async () => {
  const unavailable = await requestAiTripPeriods(candidates, { ...options, fetchImpl: (() => Promise.resolve(new Response('', { status: 503 }))) as typeof fetch });
  assert(unavailable === null, 'provider HTTP failure must fall back');
  const unconfigured = await requestAiTripPeriods(candidates, { apiKey: '', model: '' });
  assert(unconfigured === null, 'missing config must fall back');
  const hangingFetch = ((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))) as typeof fetch;
  const timeout = await requestAiTripPeriods(candidates, { ...options, timeoutMs: 1, fetchImpl: hangingFetch });
  assert(timeout === null, 'timeout must fall back');
});
