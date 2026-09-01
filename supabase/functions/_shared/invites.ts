import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Origin': '*',
};

export const TokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export async function authenticatedClient(request: Request) {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anonKey) throw new Error('Function configuration is incomplete.');
  const client = createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await client.auth.getUser();
  return error || !data.user ? null : client;
}

export async function tokenHash(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function requestJson(request: Request) {
  try {
    return await request.json() as unknown;
  } catch {
    return undefined;
  }
}
