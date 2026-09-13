import { colors, spacing } from '@/theme/tokens';
import { placeLabel } from '@/lib/presentation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { QuestRoom } from '../../../packages/contracts/src/quest';
import { ExploreSuggestionsSchema } from '../../../packages/contracts/src/explore-suggestions';
import { AppButton } from '@/components/app-button';
import { ensureAnonymousSession } from '@/lib/auth';
import { requireSupabase } from '@/lib/supabase';
import { edgeFunctionErrorMessage } from '@/lib/edge-function-error';
import { planQuest, questPlaces } from './planner-input';
import { confirmTripPlaces } from './place-import-service';
import { questStyles as s } from './quest-styles';

type Result = ReturnType<typeof ExploreSuggestionsSchema.parse>;
export function ExploreSuggestions({ room, selectedIds, disabled, onAdd, onConfirmed }: {
  room: QuestRoom; selectedIds: string[]; disabled: boolean;
  onAdd: (id: string) => void; onConfirmed: (room: QuestRoom) => void;
}) {
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState('');
  const active = useRef(false);
  const epoch = useRef({ value: 0 });
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const lifecycle = epoch.current;
    const requests = controller;
    return () => { lifecycle.value++; requests.current?.abort(); };
  }, []);
  const plan = useMemo(() => { try { return planQuest({ ...room, attractionIds: selectedIds }); } catch { return null; } }, [room, selectedIds]);
  const places = questPlaces(room);
  const freeDays = plan?.days.filter(day => day.estimatedScheduledMinutes <= 240).length ?? 0;
  async function recommend() {
    if (active.current || disabled || !freeDays || selectedIds.length >= 20) return;
    active.current = true;
    const requestEpoch = epoch.current.value;
    setBusy(true); setError(''); setResult(null);
    const abort = new AbortController(); controller.current = abort;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { reject(new Error('Online search took too long. Please try again.')); abort.abort(); }, 65000); });
      const data = await Promise.race([timeout, (async () => {
        await ensureAnonymousSession();
        if (abort.signal.aborted) throw new Error('Request timed out.');
        const response = await requireSupabase().functions.invoke('recommend-explore', { body: { tripId: room.tripId, selectedIds }, signal: abort.signal });
        if (response.error) throw new Error(await edgeFunctionErrorMessage(response.error, 'Could not recommend places.'));
        if (response.data?.error) throw new Error(response.data.error);
        return ExploreSuggestionsSchema.parse(response.data);
      })()]);
      if (requestEpoch === epoch.current.value) setResult(data);
    } catch (cause) { if (requestEpoch === epoch.current.value) setError(cause instanceof Error ? cause.message : 'Could not recommend places.'); }
    finally { clearTimeout(timer); if (requestEpoch === epoch.current.value) { active.current = false; setBusy(false); } }
  }
  async function add(id: string) {
    if (active.current || disabled || selectedIds.length >= 20 || selectedIds.includes(id)) return;
    const item = result?.places.find(place => place.id === id);
    if (!item) return;
    if (!item.candidate) { onAdd(id); return; }
    if (!result?.importId) { setError('Search again before adding this place.'); return; }
    active.current = true;
    const requestEpoch = epoch.current.value;
    setAdding(id); setError('');
    try {
      const next = await confirmTripPlaces(result.importId, [id]);
      if (requestEpoch !== epoch.current.value) return;
      onConfirmed(next); onAdd(id);
      setResult(current => current ? { ...current, places: current.places.filter(place => place.id !== id) } : current);
    } catch (cause) { if (requestEpoch === epoch.current.value) setError(cause instanceof Error ? cause.message : 'Could not add this place. Please try again.'); }
    finally { if (requestEpoch === epoch.current.value) { active.current = false; setAdding(null); } }
  }
  if (!plan) return null;
  return <View style={s.panel} testID="explore-suggestions">
    <Text style={s.heading}>{freeDays ? `${freeDays} days with room to explore` : 'Your days are filling up'}</Text>
    <Text style={s.small}>Keep some free time, or discover another place nearby.</Text>
    <AppButton label="Recommend more places" variant="secondary" loading={busy} disabled={disabled || Boolean(adding) || !freeDays || selectedIds.length >= 20} onPress={() => void recommend()} />
    {busy ? <Text accessibilityLiveRegion="polite" style={s.small}>Searching the web and checking map locations…</Text> : null}
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    {result?.places.length === 0 ? <Text style={s.body}>No more suggestions to show. Search again to discover other places.</Text> : null}
    {result?.places.filter(item => !selectedIds.includes(item.id)).map(item => {
      const place = item.candidate ?? places.find(candidate => candidate.id === item.id);
      if (!place) return null;
      return <View key={item.id} style={styles.suggestion}>
        <Text style={styles.name}>{placeLabel(place.name)}</Text>
        {item.candidate ? <Text style={s.small}>{placeLabel(item.candidate.address)}</Text> : null}
        <Text style={s.body}>{item.reason}</Text>
        {place.sourceUrl && /^https:\/\//i.test(place.sourceUrl) ? <Pressable accessibilityRole="link" accessibilityLabel={`View source for ${placeLabel(place.name)}`} style={{ minHeight: 44, justifyContent: 'center' }} onPress={() => { void Linking.openURL(place.sourceUrl!).catch(() => setError('Could not open the source link. Please try again.')); }}><Text style={s.link}>View source ↗</Text></Pressable> : null}
        <AppButton label={`Add ${placeLabel(place.name)}`} variant="secondary" loading={adding === item.id} disabled={disabled || busy || Boolean(adding) || selectedIds.length >= 20} onPress={() => void add(item.id)} />
      </View>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  suggestion: { gap: spacing.sm, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  name: { color: colors.ink, fontSize: 18, lineHeight: 26, fontWeight: '600' },
});