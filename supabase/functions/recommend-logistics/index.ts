import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requestLogisticsOptions } from '../_shared/logistics-options.ts';
import { normalizeDeparture } from '../_shared/budget-cache.ts';
import { costContext, priceBudgetOptions } from '../_shared/budget-basis.ts';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return json({ error: 'Sign in to find travel options.' }, 401);
    const input = z.object({ tripId: z.uuid(), kind: z.enum(['transport','stays']), direction: z.enum(['arrival','departure']).default('arrival'), departure: z.string().trim().min(2).max(120).optional() }).strict().safeParse(await request.json());
    if (!input.success) return json({ error: 'Choose the trip and type of travel options.' }, 400);
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const user = await client.auth.getUser();
    if (user.error || !user.data.user) return json({ error: 'Session expired. Please sign in again.' }, 401);
    const { data: room, error } = await client.rpc('get_trip_quest', { p_trip_id: input.data.tripId });
    if (error) return json({ error: 'Trip access unavailable.' }, 403);
    if (!room.period || !room.selectedCountryCode || !room.budgetSummary) return json({ error: 'Choose dates, a destination and a budget first.' }, 400);
    if (input.data.kind === 'stays' && room.period.startsOn === room.period.endsOn) return json({ transport: [], stays: [] });
    const saved = await client.from('trip_budget_basis').select('context,departure,options,estimate').eq('trip_id', input.data.tripId).eq('user_id', user.data.user.id).maybeSingle();
    if (saved.error) throw new Error('Could not load the saved budget basis.');
    const departure = input.data.departure ?? saved.data?.departure ?? 'Kuala Lumpur';
    const basis = saved.data?.context === costContext(room) && normalizeDeparture(departure) === normalizeDeparture(saved.data.departure) ? saved.data : null;
    const key = input.data.kind === 'stays' ? 'stays' : input.data.direction;
    const options = basis?.options?.[key] ?? await requestLogisticsOptions(room, { ...input.data, departure });
    return json({ ...priceBudgetOptions(options, room, basis?.estimate, basis?.options), departure });
  } catch { return json({ error: 'Could not load travel suggestions. Please retry.' }, 503); }
});

