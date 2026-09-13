import { loadQuest } from '@/features/quest/service';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { TripCarousel } from '@/features/profile/trip-carousel';
import { loadMyTrips, travellerRpc, type MyTrip } from '@/features/profile/service';
import { questStyles as s } from '@/features/quest/quest-styles';
import { useCurrentDate } from '@/lib/current-date';

export default function Trips() {
  const router = useRouter();
  const today = useCurrentDate();
  const [history, setHistory] = useState<{ trips: MyTrip[]; completed: Set<string> } | null>(null);
  const [past, setPast] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setError('');
    if (retry) setHistory(null);
    void loadMyTrips().then(result => { if (active) setHistory(result); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load your trips.'); });
    return () => { active = false; };
  }, [retry]));
  async function complete(tripId: string) {
    setBusy(true); setError('');
    try {
      await travellerRpc('record_completed_trip', { p_trip_id: tripId });
      setHistory(await loadMyTrips());
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save this memory.'); }
    finally { setBusy(false); }
  }
  async function changePlan(tripId: string) {
    setBusy(true); setError('');
    try {
      const room = await loadQuest(tripId);
      if (room.stage !== 'complete') {
        setError('Open this trip and generate its itinerary before changing the plan.');
        return;
      }
      router.push({ pathname: '/trip/[tripId]/mode', params: { tripId, changePlan: 'true' } });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not open your plan.'); }
    finally { setBusy(false); }
  }
  const trips = history?.trips.filter(trip => (history.completed.has(trip.id) || Boolean(trip.ends_on && trip.ends_on < today)) === past) ?? [];
  return <Screen><View style={s.stack}>
    <Text style={s.title}>Your trips.</Text>
    <Text style={s.body}>Pick up a plan, or revisit a favourite adventure.</Text>
    <View style={s.row}>{[false, true].map(value => <Pressable key={String(value)} accessibilityRole="tab" aria-selected={past === value} accessibilityState={{ selected: past === value }} onPress={() => setPast(value)} style={[s.chip, past === value && s.chipSelected]}><Text style={past === value ? s.chipTextSelected : s.chipText}>{value ? 'Past trips' : 'Current & upcoming'}</Text></Pressable>)}</View>
    {error ? <><Text accessibilityRole="alert" style={s.error}>{error}</Text><AppButton label="Retry loading trips" onPress={() => setRetry(value => value + 1)} /></> : null}
    {!history && !error ? <Text accessibilityLiveRegion="polite" style={s.body}>Loading your trips…</Text> : null}
    {history && trips.length ? <TripCarousel key={`${past}:${trips.map(trip => trip.id).join(',')}`} trips={trips} completed={history.completed} busy={busy}
      onOpen={tripId => router.push({ pathname: '/trip/[tripId]', params: { tripId } })}
      onComplete={tripId => void complete(tripId)}
      onChangePlan={past ? undefined : tripId => void changePlan(tripId)}
      onManage={tripId => router.push({ pathname: '/discover', params: { tripId } })} /> : history ? <View style={s.panel}>
        <Text style={s.heading}>{past ? 'Memories to come' : 'Where will you go next?'}</Text>
        <Text style={s.body}>{past ? 'Your past and completed trips will appear here.' : 'Create a trip or join one from Social to start planning.'}</Text>
        {!past ? <AppButton label="Create a trip" onPress={() => router.push('/new-trip')} /> : null}
      </View> : null}
  </View></Screen>;
}
