import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Modal, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/app-button';
import { loadMyTrips, type MyTrip } from '@/features/profile/service';
import { loadQuest } from '@/features/quest/service';
import { queueInspiration } from './planning';
import { questStyles as s } from '@/features/quest/quest-styles';
import { colors, spacing } from '@/theme/tokens';

export function UseInspiration({ inspirationId }: { inspirationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [trips, setTrips] = useState<MyTrip[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function choose() {
    setOpen(true); setBusy(true); setError('');
    try {
      const history = await loadMyTrips();
      const available = await Promise.all(history.trips.filter(trip => !history.completed.has(trip.id)).map(async trip => {
        if (!trip.planning_started_at && trip.travel_party !== 'solo') return trip;
        const room = await loadQuest(trip.id);
        return ['timing', 'picks', 'voting', 'explore'].includes(room.stage) ? trip : null;
      }));
      setTrips(available.filter((trip): trip is MyTrip => trip !== null));
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load trips.'); }
    finally { setBusy(false); }
  }
  async function use(trip: MyTrip) {
    setBusy(true); setError('');
    try {
      await queueInspiration(trip.id, inspirationId);
      setOpen(false);
      router.push({ pathname: trip.planning_started_at || trip.travel_party === 'solo' ? '/trip/[tripId]/quest' : '/trip/[tripId]', params: { tripId: trip.id } });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not prepare these places.'); }
    finally { setBusy(false); }
  }
  return <>
    <AppButton label="Use these in a trip" onPress={() => void choose()} />
    <Modal visible={open} animationType="slide" onRequestClose={() => { if (!busy) setOpen(false); }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
          <Text style={s.title}>Turn saved places into a trip</Text>
          <Text style={s.body}>Choose a trip. Your places will be ready in Explore, where you can confirm the matching locations and include them in your itinerary. Trips that have already finished choosing stops are not listed.</Text>
          {busy ? <Text accessibilityLiveRegion="polite" style={s.body}>Preparing your trips…</Text> : null}
          {error ? <><Text accessibilityRole="alert" style={s.error}>{error}</Text><AppButton label="Retry trips" disabled={busy} onPress={() => void choose()} /></> : null}
          {trips.map(trip => <AppButton key={trip.id} label={`Use these in ${trip.name}`} variant="secondary" disabled={busy} onPress={() => void use(trip)} />)}
          {!busy && !error && !trips.length ? <Text style={s.body}>Start a trip around the places you saved.</Text> : null}
          <AppButton label="Start a group trip with these ideas" disabled={busy} onPress={() => { setOpen(false); router.push({ pathname: '/create', params: { inspirationId } }); }} />
          <AppButton label="Start a solo trip with these ideas" variant="secondary" disabled={busy} onPress={() => { setOpen(false); router.push({ pathname: '/solo', params: { inspirationId } }); }} />
          <AppButton label="Back to inspiration" variant="secondary" disabled={busy} onPress={() => setOpen(false)} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </>;
}
