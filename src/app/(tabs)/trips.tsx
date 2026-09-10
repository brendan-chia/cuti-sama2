import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { TripList } from '@/features/profile/trip-list';
import { FormField } from '@/components/form-field';
import { loadMyTrips, travellerRpc, type MyTrip } from '@/features/profile/service';
import { questStyles as s } from '@/features/quest/quest-styles';
import { useCurrentDate } from '@/lib/current-date';

export default function Trips() {
  const router = useRouter();
  const today = useCurrentDate();
  const [history, setHistory] = useState<{ trips: MyTrip[]; completed: Set<string> } | null>(null);
  const [search, setSearch] = useState('');
  const [past, setPast] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const active = useRef(false);
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    const request = ++sequence.current;
    setError('');
    try { const result = await loadMyTrips(); if (active.current && request === sequence.current) setHistory(result); }
    catch (cause) { if (active.current && request === sequence.current) setError(cause instanceof Error ? cause.message : 'Could not load your trips.'); }
  }, []);
  useFocusEffect(useCallback(() => {
    active.current = true; void reload();
    return () => { active.current = false; sequence.current++; };
  }, [reload]));
  async function complete(tripId: string) {
    setBusy(true); setError('');
    try {
      await travellerRpc('record_completed_trip', { p_trip_id: tripId });
      setHistory(await loadMyTrips());
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save this memory.'); }
    finally { setBusy(false); }
  }
  const trips = history?.trips.filter(trip => (history.completed.has(trip.id) || Boolean(trip.ends_on && trip.ends_on < today)) === past && trip.name.toLowerCase().includes(search.toLowerCase())) ?? [];
  return <Screen><View style={s.stack}>
    <Text accessibilityRole="header" style={s.title}>Your trips</Text>
    <AppButton label="Create a trip" onPress={() => router.push('/new-trip')} />
    {history && history.trips.length > 4 ? <FormField label="Search trips" value={search} onChangeText={setSearch} /> : null}
    <Text style={s.body}>Pick up a plan, or revisit a favourite adventure.</Text>
    <View style={s.row}>{[false, true].map(value => <Pressable key={String(value)} accessibilityRole="tab" accessibilityState={{ selected: past === value }} onPress={() => setPast(value)} style={[s.chip, past === value && s.chipSelected]}><Text style={past === value ? s.chipTextSelected : s.chipText}>{value ? 'Past trips' : 'Current & upcoming'}</Text></Pressable>)}</View>
    {error ? <><Text accessibilityRole="alert" style={s.error}>{error}</Text><AppButton label="Retry loading trips" onPress={() => void reload()} /></> : null}
    {!history && !error ? <Text accessibilityLiveRegion="polite" style={s.body}>Loading your trips…</Text> : null}
    {history && trips.length ? <TripList key={`${past}:${trips.map(trip => trip.id).join(',')}`} trips={trips} completed={history.completed} busy={busy}
      onOpen={tripId => router.push({ pathname: '/trip/[tripId]', params: { tripId } })}
      onComplete={tripId => void complete(tripId)}
      onManage={tripId => router.push({ pathname: '/discover', params: { tripId } })} /> : history ? <View style={s.panel}>
        <Text style={s.heading}>{past ? 'Memories to come' : 'Where will you go next?'}</Text>
        <Text style={s.body}>{past ? 'Your past and completed trips will appear here.' : 'Create a trip or join with an invitation to start planning.'}</Text>
        {search ? <AppButton label="Clear search" variant="secondary" onPress={() => setSearch('')} /> : null}
      </View> : null}
    <AppButton label="Join with an invitation" variant="secondary" onPress={() => router.push('/join')} />
    <AppButton label="Discover public trips" variant="secondary" onPress={() => router.push('/discover')} />
  </View></Screen>;
}
