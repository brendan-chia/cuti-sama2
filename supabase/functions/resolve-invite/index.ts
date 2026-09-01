import { authenticatedClient, corsHeaders, json, requestJson, tokenHash } from '../_shared/invites.ts';
import { ResolveInvitePayloadSchema } from './contract.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  let client;
  try { client = await authenticatedClient(request); } catch { return json({ error: 'Function configuration is incomplete.' }, 500); }
  if (!client) return json({ error: 'Guest session is invalid or expired.' }, 401);
  const parsed = ResolveInvitePayloadSchema.safeParse(await requestJson(request));
  if (!parsed.success) return json({ error: 'This invitation is unavailable.' }, 404);
  const { data, error } = await client.rpc('resolve_invite', { p_token_hash: await tokenHash(parsed.data.token) });
  if (error || !data) return json({ error: 'This invitation is unavailable.' }, 404);
  return json(data);
});
