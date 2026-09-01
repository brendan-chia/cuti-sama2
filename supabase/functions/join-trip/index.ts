import { authenticatedClient, corsHeaders, json, requestJson, tokenHash } from '../_shared/invites.ts';
import { JoinTripPayloadSchema } from './contract.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  let client;
  try { client = await authenticatedClient(request); } catch { return json({ error: 'Function configuration is incomplete.' }, 500); }
  if (!client) return json({ error: 'Guest session is invalid or expired.' }, 401);
  const parsed = JoinTripPayloadSchema.safeParse(await requestJson(request));
  if (!parsed.success) return json({ error: 'Join details are invalid.' }, 400);
  const input = parsed.data;
  const { data, error } = await client.rpc('join_trip', {
    p_token_hash: await tokenHash(input.token),
    p_display_name: input.displayName,
    p_confirm_duplicate: input.confirmDuplicate,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) {
    if (error.code === 'P0002') return json({ error: 'This invitation is unavailable.' }, 404);
    if (error.code === '42501') return json({ error: error.message }, 403);
    return json({ error: error.code === '22023' ? error.message : 'Could not join the Trip Room.' }, error.code === '22023' ? 400 : 500);
  }
  return json(data, data?.status === 'joined' ? 201 : 200);
});
