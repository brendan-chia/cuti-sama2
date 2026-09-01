import { authenticatedClient, corsHeaders, json, requestJson } from '../_shared/invites.ts';
import { SubmitCardPayloadSchema } from './contract.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  let client;
  try { client = await authenticatedClient(request); } catch { return json({ error: 'Function configuration is incomplete.' }, 500); }
  if (!client) return json({ error: 'Member session is invalid or expired.' }, 401);
  const parsed = SubmitCardPayloadSchema.safeParse(await requestJson(request));
  if (!parsed.success) return json({ error: 'Preference card is invalid.' }, 400);
  const input = parsed.data;
  const { data, error } = await client.rpc('submit_preference_card', { p_trip_id: input.tripId, p_round_id: input.roundId, p_value: input.value, p_idempotency_key: input.idempotencyKey });
  if (error) {
    if (error.code === '42501') return json({ error: error.message }, 403);
    if (error.code === 'P0002') return json({ error: error.message }, 404);
    if (error.code === '22023') return json({ error: error.message }, 409);
    return json({ error: 'Could not submit preference card.' }, 500);
  }
  return json(data);
});
