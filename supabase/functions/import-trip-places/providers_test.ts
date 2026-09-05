import { normalizeSocialUrl } from '../../../packages/contracts/src/place-import.ts';
import { findPlaces, readPublicPost, translatePlacesToEnglish } from './providers.ts';

function assert(condition: unknown, message = 'Assertion failed'): asserts condition { if (!condition) throw new Error(message); }
Deno.test('rejects arbitrary URLs, credentials, insecure protocols and deceptive hosts', () => {
  for (const input of ['http://tiktok.com/a', 'https://127.0.0.1/', 'https://tiktok.com.evil.test/a', 'https://user:pass@tiktok.com/a', 'https://tiktok.com:444/a']) {
    let rejected = false; try { normalizeSocialUrl(input); } catch { rejected = true; }
    assert(rejected, input);
  }
  assert(normalizeSocialUrl('https://www.instagram.com/reel/example/?tracking=secret#fragment') === 'https://www.instagram.com/reel/example/');
});
Deno.test('Instagram profiles do not trigger a post fetch', async () => {
  const result = await readPublicPost('https://www.instagram.com/example/', (() => { throw new Error('Must not fetch'); }) as typeof fetch);
  assert(result === '');
});
Deno.test('short-link redirects cannot reach internal addresses', async () => {
  let calls = 0; let rejected = false;
  const fetcher = (() => { calls++; return Promise.resolve(new Response(null, { status: 302, headers: { location: 'https://127.0.0.1/private' } })); }) as typeof fetch;
  try { await readPublicPost('https://vm.tiktok.com/example/', fetcher); } catch { rejected = true; }
  assert(rejected && calls === 1);
});
Deno.test('public TikTok uses metadata without executing embed markup', async () => {
  const result = await readPublicPost('https://www.tiktok.com/@travel/video/12345', ((url) => {
    assert(String(url).startsWith('https://www.tiktok.com/oembed?url='));
    return Promise.resolve(Response.json({ title: 'Visit Kek Lok Si Temple', html: '<script>untrusted()</script>' }));
  }) as typeof fetch);
  assert(result === 'Visit Kek Lok Si Temple');
});
Deno.test('place resolution rejects wrong-country and invalid-coordinate results', async () => {
  const make = (countrycode: string, longitude = 100.3) => ({ properties: { countrycode, osm_type: 'N', osm_id: 123, name: 'Temple', city: 'Penang', country: 'Malaysia' }, geometry: { coordinates: [longitude, 5.4] } });
  const places = await findPlaces('Temple', 'Temple, Penang', 'MY', (() => Promise.resolve(Response.json({ features: [make('my'), make('jp'), make('my', 500)] }))) as typeof fetch);
  assert(places.length === 1 && places[0].id === 'osm-node-123' && places[0].latitude === 5.4);
});

Deno.test('place search explicitly requests English map labels', async () => {
  await findPlaces('東京', 'Tokyo', 'JP', ((url) => {
    assert(new URL(String(url)).searchParams.get('lang') === 'en');
    return Promise.resolve(Response.json({ features: [] }));
  }) as typeof fetch);
});

Deno.test('English translation changes display text while preserving verified map data', async () => {
  const previousKey = Deno.env.get('GROQ_API_KEY');
  const previousModel = Deno.env.get('GROQ_STRUCTURED_OUTPUT_MODEL');
  Deno.env.set('GROQ_API_KEY', 'test-key'); Deno.env.set('GROQ_STRUCTURED_OUTPUT_MODEL', 'test-model');
  try {
    const place = { id: 'osm-node-123', name: '東京ディズニーランドホテル', address: '浦安市, 千葉県, 日本', evidence: 'ホテルに泊まる', countryCode: 'JP', latitude: 35.635, longitude: 139.88, sourceUrl: 'https://www.openstreetmap.org/node/123' };
    const english = { id: place.id, name: 'Tokyo Disneyland Hotel', address: 'Urayasu, Chiba Prefecture, Japan', evidence: 'Stay at the hotel' };
    const mock = (entries: unknown[]) => (() => Promise.resolve(Response.json({ choices: [{ message: { content: JSON.stringify({ places: entries }) } }] }))) as typeof fetch;
    const result = await translatePlacesToEnglish([place], mock([english]));
    for (const [key, value] of Object.entries({ ...place, ...english })) {
      assert(result[0][key as keyof typeof place] === value, `Unexpected change to ${key}`);
    }
    for (const invalid of [[], [{ ...english, id: 'osm-node-999' }], [english, english]]) {
      let rejected = false;
      try { await translatePlacesToEnglish([place], mock(invalid)); } catch { rejected = true; }
      assert(rejected, 'Incomplete or mismatched translations must be rejected');
    }
  } finally {
    if (previousKey === undefined) Deno.env.delete('GROQ_API_KEY'); else Deno.env.set('GROQ_API_KEY', previousKey);
    if (previousModel === undefined) Deno.env.delete('GROQ_STRUCTURED_OUTPUT_MODEL'); else Deno.env.set('GROQ_STRUCTURED_OUTPUT_MODEL', previousModel);
  }
});
