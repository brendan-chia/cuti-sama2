import { placeLabel } from '@/lib/presentation';
import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { AppButton } from '@/components/app-button';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { loadInspiration } from './service';
import type { Inspiration } from '../../../packages/contracts/src/inspiration';
import { questStyles as s } from '@/features/quest/quest-styles';

function PlacePin() {
  return <Svg width={13} height={15} viewBox="0 0 16 18" {...(Platform.OS === 'web' ? { 'aria-hidden': true as const } : { accessible: false })}>
    <Path d="M8 16s5-5.3 5-9A5 5 0 0 0 3 7c0 3.7 5 9 5 9Z" fill="none" stroke={colors.ink} strokeWidth={1.4} />
    <Circle cx={8} cy={7} r={1.8} fill="none" stroke={colors.ink} strokeWidth={1.3} />
  </Svg>;
}
function UseCheck() {
  return <Svg width={15} height={15} viewBox="0 0 18 18" {...(Platform.OS === 'web' ? { 'aria-hidden': true as const } : { accessible: false })}>
    <Circle cx={9} cy={9} r={6.5} fill="none" stroke={colors.paper} strokeWidth={1.6} />
    <Path d="m6 9 2 2 4-4" fill="none" stroke={colors.paper} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>;
}
export function SavedIdeasPicker({ onChoose, disabled }: { onChoose: (text: string, inspirationId: string) => void; disabled?: boolean }) {
  const [items, setItems] = useState<Inspiration[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function load() {
    setBusy(true); setError('');
    try { setItems((await loadInspiration()).filter(i => i.status === 'ready' && i.analysis?.places.length)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load saved ideas.'); }
    finally { setBusy(false); }
  }
  return <View style={s.stack}>
    <AppButton label="Choose from my saved inspiration" variant="secondary" disabled={disabled} loading={busy} onPress={() => void load()} />
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    {items?.length === 0 ? <Text style={s.small}>No analyzed places yet. Save a social post from My profile → Saved inspiration.</Text> : null}
    {items?.map(item => {
      const places = item.analysis!.places;
      return <View key={item.id} style={styles.card}>
        <View style={styles.accent} />
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.country}>{item.folder}</Text>
          <Text style={styles.count}>{places.length} {places.length === 1 ? 'place' : 'places'} saved</Text>
        </View>
        <View style={styles.places}>
          {places.map((place, index) => <View key={`${index}-${place.name}`} style={styles.chip}>
            <PlacePin /><Text style={styles.place}>{placeLabel(place.name)}</Text>
          </View>)}
        </View>
        <AppButton label={`Use all ${places.length} ${places.length === 1 ? 'place' : 'places'}`} leading={<UseCheck />} variant="primary" disabled={disabled || busy} onPress={() => {
          onChoose(places.map(place => `${place.name}${place.location ? `, ${place.location}` : ''}`).join('\n'), item.id);
          setItems(null);
        }} />
      </View>;
    })}
  </View>;
}
const styles = StyleSheet.create({
  card: { position: 'relative', overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, paddingLeft: spacing.xl, gap: spacing.md },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: colors.orange },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingTop: spacing.xs },
  country: { color: colors.ink, fontSize: typography.heading, lineHeight: 26, fontWeight: '700', flexShrink: 1 },
  count: { color: colors.textMuted, fontSize: typography.small, lineHeight: 20 },
  places: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingBottom: spacing.xs },
  chip: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceTint, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 38 },
  place: { flexShrink: 1, color: colors.ink, fontSize: typography.body, lineHeight: 21, fontWeight: '700' },
});
