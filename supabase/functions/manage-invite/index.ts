import { authenticatedClient, corsHeaders, json, requestJson, tokenHash } from '../_shared/invites.ts';
import { ManageInvitePayloadSchema } from './contract.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  let client;
  try {
    client = await authenticatedClient(request);
  } catch {
    return json({ error: 'Function configuration is incomplete.' }, 500);
  }
  if (!client) return json({ error: 'Guest session is invalid or expired.' }, 401);

  const parsed = ManageInvitePayloadSchema.safeParse(await requestJson(request));
  if (!parsed.success) return json({ error: 'Invitation request is invalid.' }, 400);

  const input = parsed.data;
  const rawToken = 'token' in input ? input.token : null;
  const baseUrl = rawToken ? Deno.env.get('INVITE_BASE_URL') : null;
  if (rawToken && (!baseUrl || !baseUrl.startsWith('https://'))) {
    return json({ error: 'Invitation URL configuration is incomplete.' }, 500);
  }
  const expiry = rawToken ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null;
  const hashedToken = rawToken ? await tokenHash(rawToken) : null;
  const { data, error } = await client.rpc('manage_invite', {
    p_trip_id: input.tripId,
    p_action: input.action,
    p_token_hash: hashedToken,
    p_expires_at: expiry,
    p_idempotency_key: 'idempotencyKey' in input ? input.idempotencyKey : null,
  });
  if (error) {
    const denied = error.code === '42501';
    return json({ error: denied ? error.message : 'Invitation could not be updated.' }, denied ? 403 : 500);
  }

  if (!rawToken) return json(data);
  if (data?.tokenHash !== hashedToken) {
    return json({ error: 'This invitation request conflicts with an earlier retry.' }, 409);
  }
  const { tokenHash: _tokenHash, ...publicData } = data;
  return json({
    ...publicData,
    token: rawToken,
    inviteUrl: `${baseUrl!.replace(/\/$/, '')}/invite/${encodeURIComponent(rawToken)}`,
  }, 201);
});
