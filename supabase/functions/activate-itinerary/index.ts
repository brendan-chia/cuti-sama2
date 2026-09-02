import { z } from 'zod';
import { authenticatedClient, corsHeaders, json, requestJson } from '../_shared/invites.ts';

const PayloadSchema = z.object({ tripId: z.uuid(), versionId: z.uuid(), expectedActiveVersionId: z.uuid() }).strict();
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  let client; try { client = await authenticatedClient(request); } catch { return json({ error: 'Function configuration is incomplete.' }, 500); }
  if (!client) return json({ error: 'Member session is invalid or expired.' }, 401);
  const parsed = PayloadSchema.safeParse(await requestJson(request)); if (!parsed.success) return json({ error: 'Activation request is invalid.' }, 400);
  const result = await client.rpc('activate_itinerary_version', { p_trip_id: parsed.data.tripId, p_version_id: parsed.data.versionId, p_expected_active_version_id: parsed.data.expectedActiveVersionId });
  if (result.error) return json({ error: result.error.message === 'VERSION_CONFLICT' ? 'VERSION_CONFLICT' : result.error.message }, result.error.message === 'VERSION_CONFLICT' ? 409 : result.error.code === '42501' ? 403 : 400);
  return json(result.data);
});
