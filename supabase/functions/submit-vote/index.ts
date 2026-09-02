import { authenticatedClient, corsHeaders, json, requestJson } from '../_shared/invites.ts';
import { abandonOperation, beginOperation, completeOperation } from '../_shared/idempotency.ts';
import { SubmitVotePayloadSchema } from './contract.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  let client; try { client = await authenticatedClient(request); } catch { return json({ error: 'Function configuration is incomplete.' }, 500); }
  if (!client) return json({ error: 'Member session is invalid or expired.' }, 401);
  const parsed = SubmitVotePayloadSchema.safeParse(await requestJson(request));
  if (!parsed.success) return json({ error: 'Vote is invalid.' }, 400);
  const input = parsed.data;
  let claim; try { claim = await beginOperation(client, 'submit-vote', input.idempotencyKey, { tripId: input.tripId, roundId: input.roundId, optionId: input.optionId }); }
  catch (cause) { const code = cause instanceof Error ? cause.message : ''; return json({ error: code }, code === 'IDEMPOTENCY_KEY_REUSED' ? 409 : 500); }
  if (claim.replay) return json(claim.replay.body, claim.replay.status);
  if (claim.inProgress) return json({ error: 'OPERATION_IN_PROGRESS' }, 409);
  const { data, error } = await client.rpc('submit_destination_vote', { p_trip_id: input.tripId, p_round_id: input.roundId, p_option_id: input.optionId, p_idempotency_key: input.idempotencyKey });
  if (error) {
    if (error.code === '42501') { const body = { error: error.message }; await completeOperation(claim, body, 403); return json(body, 403); }
    if (error.code === 'P0002') { const body = { error: error.message }; await completeOperation(claim, body, 404); return json(body, 404); }
    if (error.code === '22023') { const body = { error: error.message }; await completeOperation(claim, body, 409); return json(body, 409); }
    await abandonOperation(claim);
    return json({ error: 'Could not submit vote.' }, 500);
  }
  await completeOperation(claim, data);
  return json(data);
});
