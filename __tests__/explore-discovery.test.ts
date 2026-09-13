import { discoverPlaces } from '../supabase/functions/recommend-explore/discovery';

const sourceUrl = 'https://tourism.example/garden';
const candidate = { id: 'osm-way-123', name: 'City Garden', address: 'Tokyo, Japan', countryCode: 'JP', latitude: 35.7, longitude: 139.7, evidence: 'A peaceful garden', sourceUrl: 'https://www.openstreetmap.org/way/123' };
const context = { countryCode: 'JP', countryName: 'Japan', selected: [], existing: [], vibes: [] };
const config = { apiKey: 'test-key', model: 'gpt-4.1-mini' };
const recommendation = { name: 'City Garden', city: 'Tokyo', reason: 'A peaceful garden', sourceUrl };
function response(places = [recommendation], sources = [sourceUrl], searched = true) {
  return { ok: true, json: async () => ({ status: 'completed', output: [
    ...(searched ? [{ type: 'web_search_call', status: 'completed', action: { sources: sources.map(url => ({ url })) } }] : []),
    { type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ places }) }] },
  ] }) } as Response;
}
it('searches OpenAI online even with no bundled candidates and returns a sourced map match', async () => {
  const fetcher = jest.fn(async () => response());
  const lookup = jest.fn(async () => [candidate]);
  const result = await discoverPlaces(context, config, lookup, fetcher);
  expect(result[0]).toEqual({ id: candidate.id, reason: recommendation.reason, candidate: { ...candidate, sourceUrl } });
  const [url, init] = (fetcher.mock.calls as unknown as [string, RequestInit][])[0];
  expect(url).toBe('https://api.openai.com/v1/responses');
  expect(JSON.parse(init.body as string)).toMatchObject({ store: false, tool_choice: 'required', tools: [{ type: 'web_search', external_web_access: true }] });
  expect(lookup).toHaveBeenCalledWith('City Garden, Tokyo', recommendation.reason, 'JP');
});
it('rejects URLs not supplied by web search and refuses answers without a search', async () => {
  const lookup = jest.fn(async () => [candidate]);
  expect(await discoverPlaces(context, config, lookup, async () => response([recommendation], []))).toEqual([]);
  expect(lookup).not.toHaveBeenCalled();
  await expect(discoverPlaces(context, config, lookup, async () => response([recommendation], [], false))).rejects.toThrow('did not complete');
});
it('filters existing places, duplicate results, ambiguous matches and wrong countries', async () => {
  expect(await discoverPlaces({ ...context, existing: [candidate] }, config, async () => [candidate], async () => response())).toEqual([]);
  expect(await discoverPlaces(context, config, async () => [candidate], async () => response([recommendation, recommendation]))).toHaveLength(1);
  expect(await discoverPlaces(context, config, async () => [candidate, { ...candidate, id: 'osm-way-124' }], async () => response())).toEqual([]);
  expect(await discoverPlaces(context, config, async () => [{ ...candidate, countryCode: 'TH' }], async () => response())).toEqual([]);
});
it('reports API and map failures instead of treating them as an empty search', async () => {
  await expect(discoverPlaces(context, config, async () => [candidate], async () => ({ ok: false }) as Response)).rejects.toThrow('temporarily unavailable');
  await expect(discoverPlaces(context, config, async () => { throw new Error('offline'); }, async () => response())).rejects.toThrow('Map lookup');
});

it('uses an OpenAI-compatible wire schema while retaining local URL validation', async () => {
  const fetcher = jest.fn(async () => response());
  await discoverPlaces(context, config, async () => [candidate], fetcher);
  const [, init] = (fetcher.mock.calls as unknown as [string, RequestInit][])[0];
  const schema = JSON.parse(init.body as string).text.format.schema;
  expect(schema.properties.places.items.properties.sourceUrl).toEqual({ type: 'string' });
  expect(schema.properties.places.items.required).toEqual(['name', 'city', 'reason', 'sourceUrl']);
  expect(schema.properties.places.items.additionalProperties).toBe(false);
  await expect(discoverPlaces(context, config, async () => [candidate],
    async () => response([{ ...recommendation, sourceUrl: 'not a URL' }]))).rejects.toThrow();
});
it('distinguishes rejected configuration from rate limiting without exposing provider bodies', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    await expect(discoverPlaces(context, config, async () => [],
      async () => ({ ok: false, status: 400 }) as Response)).rejects.toMatchObject({ code: 'SEARCH_CONFIGURATION', status: 503 });
    await expect(discoverPlaces(context, config, async () => [],
      async () => ({ ok: false, status: 429 }) as Response)).rejects.toMatchObject({ code: 'SEARCH_BUSY', status: 503 });
  } finally { log.mockRestore(); }
});
