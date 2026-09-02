import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type Stored = { request_hash: string; status: 'processing' | 'completed'; response: unknown; response_status: number | null; updated_at: string };
export type OperationClaim = { service: SupabaseClient; userId: string; operation: string; key: string; hash: string; replay: { body: unknown; status: number } | null; inProgress: boolean };

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([name, item]) => `${JSON.stringify(name)}:${stable(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
export async function operationHash(value: unknown) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stable(value)));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function beginOperation(client: SupabaseClient, operation: string, key: string, payload: unknown): Promise<OperationClaim> {
  const { data: identity, error: identityError } = await client.auth.getUser();
  if (identityError || !identity.user) throw new Error('IDENTITY_INVALID');
  const url = Deno.env.get('SUPABASE_URL'); const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) throw new Error('IDEMPOTENCY_UNAVAILABLE');
  const service = createClient(url, serviceKey, { auth: { persistSession: false } }); const hash = await operationHash(payload);
  const inserted = await service.from('operation_keys').insert({ owner_user_id: identity.user.id, operation, idempotency_key: key, request_hash: hash }).select('request_hash,status,response,response_status,updated_at').single();
  let stored = inserted.data as Stored | null; let acquired = !inserted.error;
  if (inserted.error?.code === '23505') {
    const existing = await service.from('operation_keys').select('request_hash,status,response,response_status,updated_at').eq('owner_user_id', identity.user.id).eq('operation', operation).eq('idempotency_key', key).single();
    if (existing.error) throw new Error('IDEMPOTENCY_UNAVAILABLE'); stored = existing.data as Stored;
  } else if (inserted.error) throw new Error('IDEMPOTENCY_UNAVAILABLE');
  if (!stored || stored.request_hash !== hash) throw new Error('IDEMPOTENCY_KEY_REUSED');
  if (!acquired && stored.status === 'processing' && Date.now() - Date.parse(stored.updated_at) >= 30_000) {
    const takeover = await service.from('operation_keys').update({ updated_at: new Date().toISOString() }).eq('owner_user_id', identity.user.id).eq('operation', operation).eq('idempotency_key', key).eq('request_hash', hash).eq('status', 'processing').eq('updated_at', stored.updated_at).select('updated_at').maybeSingle();
    acquired = !takeover.error && Boolean(takeover.data);
  }
  const replay = stored.status === 'completed' ? { body: stored.response, status: stored.response_status ?? 200 } : null;
  return { service, userId: identity.user.id, operation, key, hash, replay, inProgress: !acquired && stored.status === 'processing' };
}

export async function completeOperation(claim: OperationClaim, body: unknown, status = 200) {
  await claim.service.from('operation_keys').update({ status: 'completed', response: body, response_status: status, updated_at: new Date().toISOString() }).eq('owner_user_id', claim.userId).eq('operation', claim.operation).eq('idempotency_key', claim.key).eq('request_hash', claim.hash);
}
export async function abandonOperation(claim: OperationClaim) {
  await claim.service.from('operation_keys').delete().eq('owner_user_id', claim.userId).eq('operation', claim.operation).eq('idempotency_key', claim.key).eq('request_hash', claim.hash).eq('status', 'processing');
}
