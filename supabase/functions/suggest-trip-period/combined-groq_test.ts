import { buildCombinedCandidates, type DateInput } from '../../../packages/contracts/src/combined-dates.ts';
import { rankCombinedDates } from './combined-groq.ts';
const input: DateInput = { memberId: '11111111-1111-4111-8111-111111111111', startsOn: '2026-09-14', endsOn: '2026-09-18', preferences: { flexibility: '7', daysOff: [0, 6], unavailable: [{ startsOn: '2026-09-21', endsOn: '2026-09-23' }] } };
const candidates = buildCombinedCandidates([input], [{ date: '2026-09-16', name: 'Malaysia Day' }], '2026-09-05');
const config = { apiKey: 'test', model: 'test' };
function assert(value: boolean, message: string) { if (!value) throw new Error(message); }
Deno.test('Groq sees verified holiday metrics, never identities or private exclusions', async () => {
  let body = '';
  const result = await rankCombinedDates(candidates, { ...config, fetchImpl: ((_url, options) => {
    body = String(options?.body);
    return Promise.resolve(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ periodIds: candidates.slice(0, 3).map((c) => c.id) }) } }] })));
  }) as typeof fetch });
  assert(result?.length === 3, 'validated results should be returned');
  assert(body.includes('Malaysia Day'), 'verified holiday context must reach the model');
  assert(!body.includes(input.memberId) && !body.includes('\"unavailable\":') && !body.includes('2026-09-23'), 'private input must not reach provider');
});
Deno.test('invalid IDs, HTTP errors and absent configuration fall back', async () => {
  for (const response of [new Response('', { status: 503 }), new Response(JSON.stringify({ choices: [{ message: { content: '{"periodIds":["invented"]}' } }] }))]) {
    assert(await rankCombinedDates(candidates, { ...config, fetchImpl: (() => Promise.resolve(response)) as typeof fetch }) === null, 'bad responses must fall back');
  }
  assert(await rankCombinedDates(candidates, { apiKey: '', model: '' }) === null, 'no config must fall back');
});
Deno.test('timeout aborts generation', async () => {
  const result = await rankCombinedDates(candidates, { ...config, timeoutMs: 1, fetchImpl: ((_url, options) => new Promise((_resolve, reject) => options?.signal?.addEventListener('abort', () => reject(new Error('aborted'))))) as typeof fetch });
  assert(result === null, 'timeout should use calendar fallback');
});
