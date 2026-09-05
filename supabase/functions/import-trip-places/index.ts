import { createClient } from '@supabase/supabase-js';
import { normalizeSocialUrl, PlaceImportRequestSchema, type PlaceCandidate } from '../../../packages/contracts/src/place-import.ts';
import { authenticatedClient, corsHeaders, json } from '../_shared/invites.ts';
import { extractPlaces, findPlaces, readPublicPost, translatePlacesToEnglish } from './providers.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  let importId: string | undefined;
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  try {
    const client = await authenticatedClient(request);
    if (!client) return json({ error: 'Reopen the trip to restore your member session.' }, 401);
    // Limit the streamed body, including when Content-Length is missing or dishonest.
    const reader = request.body?.getReader();
    if (!reader) return json({ error: 'Add a link, caption, or screenshot.' }, 400);
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 4_100_000) { await reader.cancel(); return json({ error: 'Use a smaller screenshot (under 3 MB).' }, 413); }
      chunks.push(value);
    }
    const body = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
    const parsed = PlaceImportRequestSchema.safeParse(JSON.parse(new TextDecoder().decode(body)));
    if (!parsed.success) return json({ error: 'Add a valid link, caption, or screenshot under 3 MB.' }, 400);
    const input = parsed.data;
    const sourceUrl = input.sourceUrl ? normalizeSocialUrl(input.sourceUrl) : null;
    const { data: reservation, error } = await client.rpc('begin_place_import', { p_trip_id: input.tripId, p_request_id: input.requestId, p_source_url: sourceUrl });
    if (error) return json({ error: error.message }, error.code === '42501' ? 403 : 400);
    importId = reservation.id;
    if (reservation.status !== 'pending') return json({ importId, candidates: reservation.candidates, status: reservation.status, message: reservation.message });
    if (!reservation.fresh) return json({ error: 'This import is still being read. Try again shortly.' }, 409);
    let caption = input.text;
    if (sourceUrl) {
      try { caption = [caption, await readPublicPost(sourceUrl)].filter(Boolean).join('\n'); } catch { /* A readable caption or screenshot remains usable. */ }
    }
    let candidates: PlaceCandidate[] = [];
    if (caption || input.image) {
      const names = await extractPlaces(caption, input.image);
      for (const name of names) {
        const matches = await findPlaces(name.name, name.evidence, reservation.countryCode);
        for (const match of matches) if (!candidates.some((item) => item.id === match.id)) candidates.push(match);
      }
    }
    candidates = await translatePlacesToEnglish(candidates);
    const status = candidates.length ? 'ready' : 'needs_input';
    const message = candidates.length ? 'Check the names and addresses, then confirm the places you meant. These are possible matches.'
      : 'No places could be verified in your chosen country. Paste the caption or specific place names (one per line), or add a screenshot with visible names.';
    const { error: saveError } = await admin.from('trip_place_imports').update({ candidates, status, message }).eq('id', importId).eq('status', 'pending');
    if (saveError) throw new Error('Could not save the import. Please try again.');
    return json({ importId, candidates, status, message });
  } catch (cause) {
    if (importId) await admin.from('trip_place_imports').update({ status: 'needs_input', message: 'The import could not finish. Start another search.', candidates: [] }).eq('id', importId).eq('status', 'pending');
    const message = cause instanceof Error && !/JSON|validation|Zod/i.test(cause.message) ? cause.message : 'Could not read this post. Try a caption or specific place names.';
    return json({ error: message }, 400);
  }
});
