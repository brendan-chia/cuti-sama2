import { requireSupabase } from '@/lib/supabase';

export async function ensureAnonymousSession() {
  const client = requireSupabase();
  const { data } = await client.auth.getSession();
  if (data.session) return data.session;

  const { data: anonymousData, error } = await client.auth.signInAnonymously();
  if (error) throw new Error(`Could not start a guest session: ${error.message}`);
  if (!anonymousData.session) throw new Error('Anonymous authentication did not return a session.');
  return anonymousData.session;
}
