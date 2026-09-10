import { useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Screen } from '@/components/screen';
import { AppButton } from '@/components/app-button';
import { FormField } from '@/components/form-field';
import { loadWorkspace, updateWorkspace } from '@/features/workspace/service';
import { createTrip } from '@/features/trips/service';
import { travellerRpc } from '@/features/profile/service';
import { buildCreateTripRequest, initialCreateTripForm } from '@/features/trips/validation';
import { queueInspiration } from '@/features/inspiration/planning';
import { idempotency } from '@/lib/idempotency';
import { saveLastTripId } from '@/lib/secure-storage';
import { questStyles as s } from '@/features/quest/quest-styles';

export function NewTripScreen({ initialParty = 'group' }: { initialParty?: 'solo' | 'group' }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ destination?: string; party?: string; inspirationId?: string }>();
  const [party, setParty] = useState(params.party === 'solo' ? 'solo' : initialParty);
  const [name, setName] = useState(params.destination ? `${params.destination} trip` : 'Untitled trip');
  const [destination, setDestination] = useState(params.destination ?? '');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [createdId, setCreatedId] = useState<string | null>(null);
  const inFlight = useRef(false);
  const open = (tripId: string) => router.replace({ pathname: '/trip/[tripId]', params: { tripId, destination } });
  async function submit() {
    if (inFlight.current) return;
    const parsed = buildCreateTripRequest({ ...initialCreateTripForm, tripName: name, mode: destination.trim() ? 'destination_locked' : 'undecided', lockedDestination: destination });
    if (!parsed.success) { setError(Object.values(parsed.errors)[0] ?? 'Check your trip details.'); return; }
    inFlight.current = true; setBusy(true); setError('');
    let id: string | undefined;
    try {
      if (party === 'solo') {
        const key = await idempotency.keyFor('create', 'solo-trip', { name: name.trim() });
        const trip = await travellerRpc('create_solo_trip', { p_name: name.trim(), p_key: key });
        id = trip.tripId; setCreatedId(id!); await saveLastTripId(trip.tripId); await idempotency.complete('create', 'solo-trip', key);
      } else id = (await createTrip(parsed.data)).tripId;
      if (!id) throw new Error('The trip could not be opened. Please try again.');
      setCreatedId(id);
      let recoveryMessage = '';
      if (params.inspirationId) {
        try { await queueInspiration(id, params.inspirationId); }
        catch { recoveryMessage = 'Your trip was created. The original idea is still in Saved; add it from there when you are ready.'; }
      }
      if (destination.trim()) {
        try { const workspace = await loadWorkspace(id); await updateWorkspace(id, workspace.revision, { type: 'respond', kind: 'destination', value: { destination: destination.trim() }, abstain: false }); }
        catch { recoveryMessage += ' Open your created trip to save your destination idea when the workspace is available.'; }
      }
      if (recoveryMessage) { setError(recoveryMessage.trim()); return; }
      open(id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Your trip could not be created. Please try again.'); }
    finally { setBusy(false); inFlight.current = false; }
  }
  return <Screen footer={<AppButton label={createdId ? 'Open created trip' : 'Create trip'} loading={busy} onPress={() => createdId ? open(createdId) : void submit()} />}>
    <View style={s.stack}>
      <Text accessibilityRole="header" style={s.title}>Make room for a getaway.</Text>
      <Text style={s.body}>Start a draft. You can decide on dates and add places as you go.</Text>
      <FormField label="Trip name" value={name} onChangeText={setName} maxLength={80} editable={!busy && !createdId} />
      <Text style={s.heading}>Who is going?</Text>
      <View style={s.row}>{[['group', 'With others'], ['solo', 'Just me']].map(([value, label]) => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: party === value, disabled: busy || !!createdId }} disabled={busy || !!createdId} onPress={() => setParty(value as 'group' | 'solo')} style={[s.chip, party === value && s.chipSelected]}><Text style={party === value ? s.chipTextSelected : s.chipText}>{label}</Text></Pressable>)}</View>
      <FormField label="Destination (optional)" hint="An idea for now. Leave this blank to decide later." placeholder="e.g. George Town" value={destination} onChangeText={setDestination} maxLength={120} editable={!busy && !createdId} />
      <Text style={s.small}>Dates: not decided · No booking is made when you create a trip.</Text>
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    </View>
  </Screen>;
}
