import { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/screen';
import { FormField } from '@/components/form-field';
import { AppButton } from '@/components/app-button';
import { questStyles as s } from '@/features/quest/quest-styles';
import { travellerRpc } from '@/features/profile/service';
import { idempotency } from '@/lib/idempotency';
import { saveLastTripId } from '@/lib/secure-storage';

export default function Solo() {
  const router = useRouter(); const [name, setName] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function create() {
    setBusy(true); setError('');
    try {
      const key = await idempotency.keyFor('create', 'solo-trip', { name: name.trim() });
      const trip = await travellerRpc('create_solo_trip', { p_name: name.trim(), p_key: key });
      await saveLastTripId(trip.tripId); await idempotency.complete('create', 'solo-trip', key);
      router.replace({ pathname: '/trip/[tripId]/quest', params: { tripId: trip.tripId } });
    } catch(e) { setError(e instanceof Error ? e.message : 'Could not create your trip.'); } finally { setBusy(false); }
  }
  return <Screen><View style={s.stack}><Text style={s.kicker}>JUST YOU. ALL THE POSSIBILITIES.</Text><Text style={s.title}>Your own adventure</Text><Text style={s.body}>Choose your dates, destination and favourite stops. Get a personal budget and itinerary, without inviting anyone or waiting in a lobby.</Text><View style={s.panel}><FormField label="Solo trip name" value={name} onChangeText={setName} maxLength={80} /><Text style={s.small}>This trip stays private. Looking for company? Discover a public group trip from the home screen.</Text><AppButton label="Plan my solo trip" loading={busy} disabled={name.trim().length < 2} onPress={() => void create()} />{error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}</View></View></Screen>;
}
