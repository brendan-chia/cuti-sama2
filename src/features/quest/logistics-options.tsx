import { optionCache } from './logistics-cache';
import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { AppButton } from '@/components/app-button';
import { FormField } from '@/components/form-field';
import { ensureAnonymousSession } from '@/lib/auth';
import { loadLogisticsRecommendations } from './recommend-logistics';
import type { QuestAction, QuestRoom } from '../../../packages/contracts/src/quest';
import { type LogisticsRecommendations } from '../../../packages/contracts/src/logistics-recommendations';
import { money } from './budget-stage';
import { JourneyRecommendations, journeyTheme } from './journey-recommendations';
import { questStyles as s } from './quest-styles';

type Props = { room: QuestRoom; kind: 'transport' | 'stays'; direction?: 'arrival' | 'departure'; busy: boolean; act: (action: QuestAction) => Promise<boolean> };
export function LogisticsOptions({ room, kind, direction = 'arrival', busy, act }: Props) {
  const [editingOrigin, setEditingOrigin] = useState(false);
  const [departure, setDeparture] = useState('');
  const [query, setQuery] = useState('');
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<LogisticsRecommendations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const tripId = room.tripId;
  const context = JSON.stringify([room.period, room.selectedCountryCode, room.attractionIds, room.members.length, room.budgetSummary, room.logistics]);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const session = await ensureAnonymousSession();
        if (!active) return;
        setLoading(true); setResult(null); setError('');
        const key = JSON.stringify([session.user?.id, tripId, kind, direction, query, context]);
        const cached = optionCache.get(key);
        if (retry === 0 && session.user?.id && cached && cached.expires > Date.now()) {
          if (active) setResult(cached.data);
          return;
        }
        const parsed = await loadLogisticsRecommendations({ tripId, kind, direction, departure: query || undefined });
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
  if (kind === 'transport') return <View style={journeyTheme.panel}>
    {loading ? <Text accessibilityLiveRegion="polite" style={journeyTheme.text}>Finding journeys for your trip…</Text> : null}
    {error ? <><Text accessibilityRole="alert" style={journeyTheme.text}>{error}</Text><AppButton label="Retry suggestions" variant="secondary" disabled={loading || busy} onPress={refresh} /></> : null}
    {result && !loading ? <JourneyRecommendations key={JSON.stringify(result.transport)} options={result.transport} busy={busy} act={act} open={open} /> : null}
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: editingOrigin }} onPress={() => { if (!editingOrigin) setDeparture(query || result?.departure || 'Kuala Lumpur'); setEditingOrigin(value => !value); }} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={journeyTheme.link}>{editingOrigin ? '− Hide starting city' : `＋ Change starting city · ${query || result?.departure || 'your budget departure city'}`}</Text></Pressable>
    {editingOrigin ? <View style={s.panel}><FormField label="Travelling from" value={departure} onChangeText={setDeparture} editable={!loading && !busy} /><AppButton label="Find journeys" variant="secondary" disabled={loading || busy || departure.trim().length < 2} onPress={() => { setEditingOrigin(false); refresh(); }} /></View> : null}
  </View>;
  return <View style={s.stack}>
    <Text style={s.heading}>Suggested stays</Text>
    <Text style={s.small}>AI planning suggestions for your dates and budget. Prices, locations and journey times are estimates. Check availability before booking. Confirm a stay to deduct its cost from your budget. Adding an option for comparison does not deduct it.</Text>
    {loading ? <Text accessibilityLiveRegion="polite" style={s.body}>Finding options for your trip…</Text> : null}
    {error ? <><Text accessibilityRole="alert" style={s.error}>{error}</Text><AppButton label="Retry suggestions" variant="secondary" disabled={loading || busy} onPress={refresh} /></> : null}
    {result?.stays.slice().sort((a, b) => a.stay.totalCost - b.stay.totalCost).map(({ reason, category, stay }) => {
      const saved = room.logistics?.stays.find(item => item.name === stay.name && item.area === stay.area);
      const added = Boolean(saved);
      const selected = Boolean(saved && room.logistics?.selectedStayId === saved.id);
      return <View key={stay.id} style={s.panel}>{category ? <Text style={s.kicker}>{category === "cheap" ? "Cheap" : category === "mid-range" ? "Mid-range" : "Expensive"}</Text> : null}<Text style={s.heading}>{stay.name}</Text><Text style={s.body}>{stay.area}</Text>
        <Text style={s.strong}>{money(stay.totalCost)} estimated total · {room.members.length} {room.members.length === 1 ? 'traveller' : 'travellers'}</Text>
        <Text style={s.small}>{stay.checkIn} – {stay.checkOut} · all nights</Text><Text style={s.body}>{reason}</Text>
        <AppButton label="Check property & availability" variant="secondary" onPress={() => void open(stay.bookingLink)} />
        {room.travelParty !== 'solo' ? <AppButton label={added ? 'Added to your options' : `Add ${stay.name}`} disabled={busy || added || (room.logistics?.stays.length ?? 0) >= 20} onPress={() => void act({ type: 'stay', stay })} /> : null}
        {room.currentRole === 'organizer' ? <AppButton label={selected ? 'Selected stay' : 'Select stay & update budget'} disabled={busy || selected || (!added && (room.logistics?.stays.length ?? 0) >= 20)} onPress={() => void (async () => {
          if (!saved && !await act({ type: 'stay', stay })) return;
          await act({ type: 'confirm_stay', stayId: saved?.id ?? stay.id });
        })()} /> : null}
      </View>;
    })}
    {result && !result.stays.length ? <Text style={s.body}>No overnight stay is needed for a one-day trip.</Text> : null}
  </View>;
}
