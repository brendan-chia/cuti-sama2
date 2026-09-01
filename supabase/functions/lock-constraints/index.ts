import { authenticatedClient, corsHeaders, json, requestJson } from '../_shared/invites.ts';
import { LockConstraintsPayloadSchema } from './contract.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  let client;
  try { client = await authenticatedClient(request); }
  catch { return json({ error: 'Function configuration is incomplete.' }, 500); }
  if (!client) return json({ error: 'Member session is invalid or expired.' }, 401);
  const parsed = LockConstraintsPayloadSchema.safeParse(await requestJson(request));
  if (!parsed.success) return json({ error: 'Trip identifier is invalid.' }, 400);
  const { data, error } = await client.rpc('lock_constraint_collection', { p_trip_id: parsed.data.tripId, p_idempotency_key: crypto.randomUUID() });
  if (error) {
    if (error.code === '42501') return json({ error: error.message }, 403);
    if (error.code === '22023') return json({ error: error.message }, 409);
    return json({ error: 'Could not lock constraint collection.' }, 500);
  }
  return json(data);
});
