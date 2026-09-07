import { useEffect, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { AppButton } from '@/components/app-button';
import { FormField } from '@/components/form-field';
import { ensureAnonymousSession } from '@/lib/auth';
import { requireSupabase } from '@/lib/supabase';
import { edgeFunctionErrorMessage } from '@/lib/edge-function-error';
import type { QuestAction, QuestRoom } from '../../../packages/contracts/src/quest';
import { LogisticsRecommendationsSchema, type LogisticsRecommendations } from '../../../packages/contracts/src/logistics-recommendations';
import { money } from './budget-stage';
import { questStyles as s } from './quest-styles';

type Props = { room: QuestRoom; kind: 'transport' | 'stays'; direction?: 'arrival' | 'departure'; busy: boolean; act: (action: QuestAction) => Promise<boolean> };
// Keep choices stable when switching tabs; separate cache entries by signed-in owner.
const optionCache = new Map<string, { expires: number; data: LogisticsRecommendations }>();
export function LogisticsOptions({ room, kind, direction = 'arrival', busy, act }: Props) {
  const [departure, setDeparture] = useState('Kuala Lumpur');
  const [query, setQuery] = useState('Kuala Lumpur');
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<LogisticsRecommendations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const tripId = room.tripId;
  const context = JSON.stringify([room.period, room.selectedCountryCode, room.attractionIds, room.members.length, room.budgetSummary]);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const session = await ensureAnonymousSession();
        const key = JSON.stringify([session.user?.id, tripId, kind, direction, query, context]);
        const cached = optionCache.get(key);
        if (retry === 0 && session.user?.id && cached && cached.expires > Date.now()) {
          if (active) setResult(cached.data);
          return;
        }
        const { data, error: failure } = await requireSupabase().functions.invoke('recommend-logistics', { body: { tripId, kind, direction, departure: query } });
        if (failure) throw new Error(await edgeFunctionErrorMessage(failure, 'Could not load options.'));
        const parsed = LogisticsRecommendationsSchema.parse(data);
        if (session.user?.id) {
          if (optionCache.size >= 24) optionCache.delete(optionCache.keys().next().value!);
          optionCache.set(key, { expires: Date.now() + 5 * 60_000, data: parsed });
        }
        if (active) setResult(parsed);
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'Could not load options.'); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [tripId, kind, direction, query, retry, context]);
  function refresh() { setResult(null); setError(''); setLoading(true); setQuery(departure.trim()); setRetry(n => n + 1); }
  async function open(url: string) { try { await Linking.openURL(url); } catch { setError('Could not open search. Please try again.'); } }
  return <View style={s.stack}>
    <Text style={s.heading}>{kind === 'transport' ? 'Choose a journey' : 'Suggested stays'}</Text>
    <Text style={s.small}>AI planning suggestions for your dates and budget. Prices, locations and journey times are estimates. Check availability before booking; selecting an option saves it to your plan.</Text>
    {kind === 'transport' ? <><FormField label="Travelling from" value={departure} onChangeText={setDeparture} editable={!loading && !busy} /><AppButton label="Find journeys" variant="secondary" disabled={loading || busy || departure.trim().length < 2} onPress={refresh} /></> : null}
    {loading ? <Text accessibilityLiveRegion="polite" style={s.body}>Finding options for your trip…</Text> : null}
    {error ? <><Text accessibilityRole="alert" style={s.error}>{error}</Text><AppButton label="Retry suggestions" variant="secondary" disabled={loading || busy} onPress={refresh} /></> : null}
    {result?.transport.map(({ label, reason, journey }, i) => <View key={i} style={s.panel}>
      <Text style={s.heading}>{label}</Text><Text style={s.body}>{journey.departureLocation} → {journey.arrivalLocation}</Text>
      <Text style={s.strong}>{money(journey.cost)} estimated / person · one way</Text>
      <Text style={s.small}>Suggested departure: {journey.departureAt.replace('T', ' ')}{'\n'}Suggested arrival: {journey.arrivalAt.replace('T', ' ')}</Text>
      <Text style={s.body}>{reason}</Text>
      <AppButton label="Check routes & fares" variant="secondary" onPress={() => void open(journey.bookingLink!)} />
      <AppButton label={`Select ${label}`} disabled={busy} onPress={() => void act({ type: 'transport', transport: { ...journey, status: 'selected' } })} />
    </View>)}
    {result?.stays.map(({ reason, stay }) => {
      const added = room.logistics?.stays.some(item => item.name === stay.name && item.area === stay.area);
      return <View key={stay.id} style={s.panel}><Text style={s.heading}>{stay.name}</Text><Text style={s.body}>{stay.area}</Text>
        <Text style={s.strong}>{money(stay.totalCost)} estimated total · {room.members.length} {room.members.length === 1 ? 'traveller' : 'travellers'}</Text>
        <Text style={s.small}>{stay.checkIn} – {stay.checkOut} · all nights</Text><Text style={s.body}>{reason}</Text>
        <AppButton label="Check property & availability" variant="secondary" onPress={() => void open(stay.bookingLink)} />
        <AppButton label={added ? 'Added to your options' : `Add ${stay.name}`} disabled={busy || added || (room.logistics?.stays.length ?? 0) >= 20} onPress={() => void act({ type: 'stay', stay })} />
      </View>;
    })}
    {result && !result.stays.length && kind === 'stays' ? <Text style={s.body}>No overnight stay is needed for a one-day trip.</Text> : null}
  </View>;
}
