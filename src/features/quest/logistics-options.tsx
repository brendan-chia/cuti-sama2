import { colors, radius, spacing, typography } from '@/theme/tokens';
import { useReducedMotion } from '@/theme/motion';
import { placeLabel } from '@/lib/presentation';
import { optionCache } from './logistics-cache';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
    <Pressable accessibilityRole="button" aria-expanded={editingOrigin} accessibilityState={{ expanded: editingOrigin }} onPress={() => { if (!editingOrigin) setDeparture(query || result?.departure || 'Kuala Lumpur'); setEditingOrigin(value => !value); }} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={journeyTheme.link}>{editingOrigin ? '− Hide starting city' : `＋ Change starting city · ${query || result?.departure || 'your budget departure city'}`}</Text></Pressable>
    {editingOrigin ? <View style={s.panel}><FormField label="Travelling from" value={departure} onChangeText={setDeparture} editable={!loading && !busy} /><AppButton label="Find journeys" variant="secondary" disabled={loading || busy || departure.trim().length < 2} onPress={() => { setEditingOrigin(false); refresh(); }} /></View> : null}
  </View>;
  return <View style={s.stack}>
    <Text style={s.heading}>Suggested stays</Text>
    {loading ? <Text accessibilityLiveRegion="polite" style={s.body}>Finding options for your trip…</Text> : null}
    {error ? <><Text accessibilityRole="alert" style={s.error}>{error}</Text><AppButton label="Retry suggestions" variant="secondary" disabled={loading || busy} onPress={refresh} /></> : null}
    {result && !loading && result.stays.length ? <StayCards key={JSON.stringify(result.stays)} room={room} options={result.stays} busy={busy} act={act} open={open} /> : null}
    {result && !result.stays.length ? <Text style={s.body}>No overnight stay is needed for a one-day trip.</Text> : null}
  </View>;
}

function StayCards({ room, options, busy, act, open }: {
  room: QuestRoom; options: LogisticsRecommendations['stays']; busy: boolean;
  act: Props['act']; open: (url: string) => Promise<void>;
}) {
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(280);
  const scroll = useRef<ScrollView>(null);
  const reducedMotion = useReducedMotion();
  const sorted = [...options].sort((a, b) => a.stay.totalCost - b.stay.totalCost);
  const activeIndex = Math.max(0, Math.min(index, sorted.length - 1));
  function go(next: number) {
    setIndex(next);
    scroll.current?.scrollTo({ x: next * width, animated: !reducedMotion });
  }
  return <View style={s.stack}>
    <View onLayout={({ nativeEvent }) => {
      const next = nativeEvent.layout.width;
      if (next > 0 && next !== width) {
        setWidth(next);
        scroll.current?.scrollTo({ x: activeIndex * next, animated: false });
      }
    }}>
      <ScrollView ref={scroll} testID="stay-recommendation-cards" horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={({ nativeEvent }) => setIndex(Math.max(0, Math.min(sorted.length - 1, Math.round(nativeEvent.contentOffset.x / width))))}>
        {sorted.map(({ reason, category, stay }, i) => {
          const saved = room.logistics?.stays.find(item => item.name === stay.name && item.area === stay.area);
          const selected = Boolean(saved && room.logistics?.selectedStayId === saved.id);
          return <View key={stay.id} accessibilityElementsHidden={i !== activeIndex} importantForAccessibility={i !== activeIndex ? 'no-hide-descendants' : 'auto'} style={{ width, paddingRight: 2 }}>
            <View style={[s.panel, styles.card]}>
              {category ? <Text style={s.kicker}>{category === 'cheap' ? 'Cheap' : category === 'mid-range' ? 'Mid-range' : 'Expensive'}</Text> : null}
              <Text style={s.heading}>{placeLabel(stay.name)}</Text><Text style={s.body}>{placeLabel(stay.area)}</Text>
              <Text style={styles.price}>{money(stay.totalCost)}</Text>
              <Text style={s.small}>Estimated total · {room.members.length} {room.members.length === 1 ? 'traveller' : 'travellers'} · all nights</Text>
              <Text style={s.small}>{stay.checkIn} – {stay.checkOut}</Text>
              <View style={styles.explanation}><Text style={s.body}>{reason}</Text></View>
              <AppButton label="Check property & availability" variant="secondary" onPress={() => void open(stay.bookingLink)} />
              {room.currentRole === 'organizer' ? <AppButton label={selected ? 'Selected stay' : 'Select stay & update budget'} disabled={busy || selected || (!saved && (room.logistics?.stays.length ?? 0) >= 20)} onPress={() => void (async () => {
                if (!saved && !await act({ type: 'stay', stay })) return;
                await act({ type: 'confirm_stay', stayId: saved?.id ?? stay.id });
              })()} /> : null}
            </View>
          </View>;
        })}
      </ScrollView>
    </View>
    {sorted.length > 1 ? <View>
      <View style={styles.dots}>{sorted.map(({ stay }, i) => <Pressable key={stay.id} accessibilityRole="button" accessibilityLabel={`Show hotel ${i + 1}: ${placeLabel(stay.name)}`} accessibilityState={{ selected: i === activeIndex }} onPress={() => go(i)} style={styles.dotTarget}><View style={[styles.dot, i === activeIndex && styles.dotActive]} /></Pressable>)}</View>
      <Text accessibilityLiveRegion="polite" style={styles.hint}>Hotel {activeIndex + 1} of {sorted.length} · Swipe for alternatives</Text>
    </View> : null}
  </View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm },
  price: { color: colors.ink, fontSize: 24, lineHeight: 32, fontWeight: '700', marginTop: spacing.sm },
  explanation: { borderLeftWidth: 3, borderLeftColor: colors.leaf, paddingLeft: spacing.lg, marginVertical: spacing.sm },
  dots: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  dotTarget: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 7, height: 7, backgroundColor: colors.border, borderRadius: radius.pill },
  dotActive: { width: 22, backgroundColor: colors.sky },
  hint: { color: colors.textMuted, fontSize: typography.small, lineHeight: 21, textAlign: 'center' },
});
