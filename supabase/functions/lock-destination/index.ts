import { authenticatedClient, corsHeaders, json, requestJson } from '../_shared/invites.ts';
import { LockDestinationPayloadSchema } from './contract.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  let client; try { client = await authenticatedClient(request); } catch { return json({ error: 'Function configuration is incomplete.' }, 500); }
  if (!client) return json({ error: 'Member session is invalid or expired.' }, 401);
  const parsed = LockDestinationPayloadSchema.safeParse(await requestJson(request));
  if (!parsed.success) return json({ error: 'Destination action is invalid.' }, 400);
  const input = parsed.data;
  const { data, error } = await client.rpc('set_locked_destination', { p_trip_id: input.tripId, p_option_id: input.optionId, p_action: input.action, p_idempotency_key: input.idempotencyKey });
  if (error) {
    if (error.code === '42501') return json({ error: error.message }, 403);
    if (error.code === '22023') return json({ error: error.message }, 409);
    return json({ error: 'Could not update the locked destination.' }, 500);
  }
  return json(data);
});
