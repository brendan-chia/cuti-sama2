import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Modal, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/app-button';
import { loadMyTrips, type MyTrip } from '@/features/profile/service';
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
      setTrips(history.trips.filter(trip => !history.completed.has(trip.id)));
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load trips.'); }
    finally { setBusy(false); }
  }
  async function use(trip: MyTrip) {
    setBusy(true); setError('');
    try {
      await queueInspiration(trip.id, inspirationId);
      setOpen(false);
      router.push({ pathname: '/trip/[tripId]', params: { tripId: trip.id, section: 'places' } });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not prepare these places.'); }
    finally { setBusy(false); }
  }
  return <>
    <AppButton label="Use these in a trip" onPress={() => void choose()} />
    <Modal visible={open} animationType="slide" onRequestClose={() => { if (!busy) setOpen(false); }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
          <Text style={s.title}>Turn saved places into a trip</Text>
          <Text style={s.body}>Choose a trip, then review the places you want to add. They stay unscheduled until you choose a day.</Text>
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
