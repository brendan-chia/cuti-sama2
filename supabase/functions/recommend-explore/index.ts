import { createClient } from '@supabase/supabase-js';
import { countryByCode } from '../../../packages/contracts/src/countries.ts';
import { ExploreSuggestionRequestSchema } from '../../../packages/contracts/src/explore-suggestions.ts';
import { findPlaces } from '../import-trip-places/providers.ts';
import { discoverPlaces, ExploreSearchError } from './discovery.ts';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const createAdmin = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  let importId: string | undefined;
  let admin: ReturnType<typeof createAdmin> | undefined;
  try {
    const parsed = ExploreSuggestionRequestSchema.safeParse(await request.json());
    if (!parsed.success) return json({ error: 'Choose a valid trip and up to 20 places.' }, 400);
    const input = parsed.data;
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Sign in to your trip first.' }, 401);
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const user = await client.auth.getUser();
    if (user.error || !user.data.user) return json({ error: 'Session expired.' }, 401);
    const { data: room, error } = await client.rpc('get_trip_quest', { p_trip_id: input.tripId });
    if (error || !room) return json({ error: 'Trip access unavailable.' }, 403);
    const country = countryByCode(room.selectedCountryCode);
    if (room.stage !== 'explore' || !room.period || !country) return json({ error: 'Choose your dates and destination before exploring.' }, 400);
    const places = [...country.attractions, ...(room.importedPlaces ?? [])];
    if (input.selectedIds.some(id => !places.some(place => place.id === id))) return json({ error: 'Refresh your trip places first.' }, 400);
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) return json({ error: 'Online place recommendations are not configured.' }, 503);
    // Reuse the member authorization, Explore gate and hourly rate limit before paid search.
    const { data: reservation, error: reserveError } = await client.rpc('begin_place_import', {
      p_trip_id: input.tripId, p_request_id: crypto.randomUUID(), p_source_url: null,
    });
    if (reserveError || !reservation?.fresh) return json({ error: reserveError?.message ?? 'Could not start online search.' }, 400);
    importId = String(reservation.id);
    admin = createAdmin();
    const results = await discoverPlaces({
      countryCode: country.code, countryName: country.name,
      // Send only shared interests and place context, never member identities or private budgets.
      selected: places.filter(place => input.selectedIds.includes(place.id)).map(({ id, name, latitude, longitude }) => ({ id, name, latitude, longitude })),
      existing: places.map(({ id, name, latitude, longitude }) => ({ id, name, latitude, longitude })),
      vibes: room.groupVibes ?? [],
    }, { apiKey, model: Deno.env.get('OPENAI_EXPLORE_MODEL') || 'gpt-4.1-mini' }, findPlaces);
    const { error: saveError } = await admin.from('trip_place_imports').update({
      candidates: results.map(item => item.candidate), status: results.length ? 'ready' : 'needs_input',
      message: results.length ? 'Review the address and source before adding a place.' : 'No new places could be matched to map records.',
    }).eq('id', importId).eq('status', 'pending');
    if (saveError) throw new ExploreSearchError('SAVE_FAILED', 'Could not save recommendations. Please try again.');
    return json({ importId, places: results });
  } catch (cause) {
    const failure = cause instanceof ExploreSearchError ? cause
      : cause instanceof Error && ['TimeoutError', 'AbortError'].includes(cause.name)
      ? new ExploreSearchError('SEARCH_TIMEOUT', 'Online search took too long. Please try again.', 504)
      : new ExploreSearchError('SEARCH_FAILED', 'Could not finish online search. Please try again.');
    console.error('recommend-explore failed', { code: failure.code });
    if (admin && importId) await admin.from('trip_place_imports').update({ status: 'needs_input', message: failure.message, candidates: [] }).eq('id', importId).eq('status', 'pending');
    return json({ error: failure.message, code: failure.code }, failure.status);
  }
});
