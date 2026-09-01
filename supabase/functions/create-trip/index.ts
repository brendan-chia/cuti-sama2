import { createClient } from '@supabase/supabase-js';

import { CreateTripPayloadSchema } from './contract.ts';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Origin': '*',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Authentication is required.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) return json({ error: 'Function configuration is incomplete.' }, 500);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Request body must be valid JSON.' }, 400);
  }

  const parsed = CreateTripPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return json({ error: 'Trip details are invalid.', issues: parsed.error.flatten().fieldErrors }, 400);
  }

  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) return json({ error: 'Guest session is invalid or expired.' }, 401);

  const input = parsed.data;
  const { data, error } = await client.rpc('create_trip', {
    p_name: input.tripName,
    p_mode: input.mode,
    p_destinations: input.destinations,
    p_starts_on: input.startsOn,
    p_ends_on: input.endsOn,
    p_idempotency_key: input.idempotencyKey,
  });

  if (error) {
    const clientError = error.code === '22023';
    return json(
      { error: clientError ? error.message : 'The Trip Room could not be created.', code: error.code },
      clientError ? 400 : 500,
    );
  }

  return json(data, 201);
});
