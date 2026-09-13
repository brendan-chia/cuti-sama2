import { DemoTrips } from '@/features/discovery/demo-trips';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/screen';
import { AppButton } from '@/components/app-button';
import { FormField } from '@/components/form-field';
import { questStyles as s } from '@/features/quest/quest-styles';
import { travellerRpc } from '@/features/profile/service';
import { requireSupabase } from '@/lib/supabase';
import { ensureAnonymousSession } from '@/lib/auth';
import { saveLastTripId } from '@/lib/secure-storage';

type Listing = { id: string; name: string; description: string; starts_on: string | null; ends_on: string | null; travellers: number };
export default function Discover() {
  const router = useRouter(); const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const [listings, setListings] = useState<Listing[]>([]); const [name, setName] = useState(''); const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [loaded, setLoaded] = useState(false);
  async function run(action: () => Promise<unknown>) { setBusy(true); setMessage(''); try { await action(); } catch(e) { setMessage(e instanceof Error ? e.message : 'Please try again.'); } finally { setBusy(false); } }
  async function refresh() { setListings(await travellerRpc('discover_trips')); setLoaded(true); }
  useEffect(() => {
    let active = true;
    void travellerRpc('discover_trips').then(data => { if (active) { setListings(data); setLoaded(true); } }).catch(e => { if (active) setMessage(e instanceof Error ? e.message : 'Could not load trips.'); });
    return () => { active = false; };
  }, []);
  async function publish(published: boolean) {
    await ensureAnonymousSession();
    const client = requireSupabase();
    const result = published ? await client.from('trip_listings').upsert({ trip_id: tripId, description: description.trim(), published }) : await client.from('trip_listings').update({ published: false }).eq('trip_id', tripId).select('trip_id');
    if (result.error) throw new Error(result.error.message);
    if (!published && !result.data?.length) throw new Error('No listing was changed. Only the organiser can manage it.');
    await refresh(); setMessage(published ? 'Your trip is now public.' : 'Listing hidden.');
  }
  return <Screen><View style={s.stack}><Text style={s.title}>Find your travel people</Text><Text style={s.body}>Browse open trips and join a small group. Joining closes when planning begins.</Text>
    {message ? <Text accessibilityRole="alert" style={s.error}>{message}</Text> : null}
    {tripId ? <View style={s.panel}><Text style={s.heading}>Open your trip to the public</Text><Text style={s.body}>Only the organiser can publish. Your trip name and this description will be public. New members can access the shared Trip Room.</Text>
      <FormField label="Public trip description" multiline maxLength={1000} value={description} onChangeText={setDescription} placeholder="Destination, travel dates, interests and who you'd like to travel with" />
      <AppButton label="Publish trip" disabled={busy || description.trim().length < 10} onPress={() => void run(() => publish(true))} />
      <AppButton label="Hide listing" disabled={busy} variant="secondary" onPress={() => void run(() => publish(false))} />
    </View> : null}
    {!tripId ? <DemoTrips /> : null}
    <Text accessibilityRole="header" style={s.heading}>Community trips</Text>
    <FormField label="Your name when joining" value={name} onChangeText={setName} maxLength={50} />
    <AppButton label="Refresh trips" disabled={busy} variant="secondary" onPress={() => void run(refresh)} />
    {loaded && !listings.length ? <Text style={s.body}>No open trips yet. Start a group trip and publish it from your profile.</Text> : null}
    {listings.map(trip => <View style={s.panel} key={trip.id}><Text style={s.heading}>{trip.name}</Text><Text style={s.body}>{trip.description}</Text><Text style={s.small}>{trip.starts_on ?? 'Dates to decide'} · {trip.travellers}/8 travellers</Text>
      <AppButton label={trip.travellers >= 8 ? 'Trip full' : 'Join this trip'} disabled={busy || !name.trim() || trip.travellers >= 8} onPress={() => void run(async () => { await travellerRpc('join_public_trip', { p_trip_id: trip.id, p_display_name: name.trim() }); await saveLastTripId(trip.id); router.push({ pathname: '/trip/[tripId]', params: { tripId: trip.id } }); })} />
    </View>)}
  </View></Screen>;
}
