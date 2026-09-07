import { ensureAnonymousSession } from '@/lib/auth';
import { requireSupabase } from '@/lib/supabase';

export async function travellerRpc(name: string, args: Record<string, unknown> = {}) {
  await ensureAnonymousSession();
  const { data, error } = await requireSupabase().rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

export async function loadProfile() {
  const session = await ensureAnonymousSession();
  const client = requireSupabase();
  const existing = await client.from('traveller_profiles').select('*').eq('user_id', session.user.id).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (!existing.data) {
    const inserted = await client.from('traveller_profiles').insert({ user_id: session.user.id });
    if (inserted.error && inserted.error.code !== '23505') throw new Error(inserted.error.message);
  }
  const { data, error } = await client.from('traveller_profiles').select('*').eq('user_id', session.user.id).single();
  if (error) throw new Error(error.message);
  return data as { display_name: string; avatar_url: string | null; favourite_places: string[]; referral_code: string };
}

export async function saveProfile(displayName: string, avatar: string | null, favourites: string[]) {
  if (!displayName.trim() || displayName.trim().length > 50) throw new Error('Enter a name with 1–50 characters.');
  if (favourites.length > 30 || favourites.some((place) => place.length > 120)) throw new Error('Save up to 30 places, with at most 120 characters each.');
  const session = await ensureAnonymousSession();
  const { error } = await requireSupabase().from('traveller_profiles').update({ display_name: displayName.trim(), avatar_url: avatar, favourite_places: favourites }).eq('user_id', session.user.id);
  if (error) throw new Error(error.message);
}

export type MyTrip = { id: string; name: string; ends_on: string | null; travel_party: string; planning_started_at: string | null };
export async function loadMyTrips() {
  await ensureAnonymousSession();
  const client = requireSupabase();
  const [trips, memories] = await Promise.all([
    client.from('trips').select('id,name,ends_on,travel_party,planning_started_at').order('created_at', { ascending: false }),
    client.from('travel_memories').select('trip_id'),
  ]);
  if (trips.error || memories.error) throw new Error(trips.error?.message ?? memories.error?.message);
  return { trips: trips.data as MyTrip[], completed: new Set((memories.data ?? []).map((m) => m.trip_id as string)) };
}
