import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { LogisticsRecommendations } from '../../../packages/contracts/src/logistics-recommendations';
import type { QuestAction } from '../../../packages/contracts/src/quest';
import { money } from './budget-stage';
import { AppButton } from '@/components/app-button';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '@/theme/tokens';

type Props = {
  options: LogisticsRecommendations['transport'];
  busy: boolean;
  act: (action: QuestAction) => Promise<boolean>;
  open: (url: string) => Promise<void>;
};
const modes = { flight: '✈ Flight', train: '↔ Train', bus: '↔ Bus', car: '↔ Car' };
function duration(departure: string, arrival: string) {
  const minutes = Math.round((Date.parse(arrival) - Date.parse(departure)) / 60000);
  const hours = Math.floor(minutes / 60);
  return [hours ? `${hours}h` : '', minutes % 60 ? `${minutes % 60}m` : ''].filter(Boolean).join(' ');
}
function dateLabel(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function timeLabel(value: string) {
  const hour = Number(value.slice(11, 13));
  return `${hour % 12 || 12}:${value.slice(14, 16)} ${hour >= 12 ? 'PM' : 'AM'}`;
}

export function JourneyRecommendations({ options, busy, act, open }: Props) {
  const [preview, setPreview] = useState<LogisticsRecommendations['transport'][number] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const savingRef = useRef(false);
  async function saveJourney() {
    if (!preview || busy || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError('');
    try {
      if (await act({ type: 'transport', transport: { ...preview.journey, status: 'selected' } })) setPreview(null);
      else setSaveError('Your journey could not be saved. Please try again.');
    } catch {
      setSaveError('Your journey could not be saved. Please try again.');
    } finally { savingRef.current = false; setSaving(false); }
  }
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(280);
  const scroll = useRef<ScrollView>(null);
  const activeIndex = Math.min(index, options.length - 1);
  const active = options[activeIndex];
  if (!active) return <Text style={styles.text}>No journeys found. Try a different starting city.</Text>;
  const go = (next: number) => {
    setIndex(next);
    scroll.current?.scrollTo({ x: next * width, animated: true });
  };
  return <View style={styles.stack} testID="journey-recommendations">
    <View style={styles.route} accessibilityLiveRegion="polite">
      <Text style={styles.routeText}>{active.journey.departureLocation} → {active.journey.arrivalLocation}</Text>
      <Text style={styles.text}>{dateLabel(active.journey.departureAt)}</Text>
    </View>
    <View onLayout={({ nativeEvent }) => {
      const next = nativeEvent.layout.width;
      if (next > 0 && next !== width) {
        setWidth(next);
        scroll.current?.scrollTo({ x: activeIndex * next, animated: false });
      }
    }}>
      <ScrollView ref={scroll} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={({ nativeEvent }) => setIndex(Math.max(0, Math.min(options.length - 1, Math.round(nativeEvent.contentOffset.x / width))))}>
        {options.map(({ journey, label, reason }, i) => <View key={`${label}-${i}`} accessibilityElementsHidden={i !== activeIndex} importantForAccessibility={i !== activeIndex ? 'no-hide-descendants' : 'auto'} style={{ width, paddingRight: 2 }}>
          <View style={[styles.card, i === 0 && styles.recommended]}>
            <Text style={[styles.badge, i === 0 && styles.recommendedBadge]}>{i === 0 ? '★ RECOMMENDED' : `ALTERNATIVE ${i}`}</Text>
            <Text style={styles.mode}>{modes[journey.mode]}</Text>
            <Text style={styles.duration}>{duration(journey.departureAt, journey.arrivalAt)}</Text>
            <Text style={styles.price}>{money(journey.cost)} <Text style={styles.text}>/ person</Text></Text>
            <Text style={styles.text}>{/\bdirect\b|non[ -]?stop/i.test(`${label} ${reason}`) ? 'Direct' : label}</Text>
            <View style={styles.explanation}>
              <Text style={styles.explanationTitle}>{i === 0 ? 'Why we recommend this' : 'Why consider this'}</Text>
              <Text style={styles.text}>{reason}</Text>
            </View>
            <View style={styles.cardAction}><AppButton label="Select this journey" disabled={busy} onPress={() => { setSaveError(''); setPreview(options[i]); }} /></View>
          </View>
        </View>)}
      </ScrollView>
    </View>
    {options.length > 1 ? <View>
      <View style={styles.dots}>
        {options.map((option, i) => <Pressable key={i} accessibilityRole="button" accessibilityLabel={`Show option ${i + 1}: ${option.label}`} aria-pressed={i === activeIndex} accessibilityState={{ selected: i === activeIndex }} onPress={() => go(i)} style={styles.dotTarget}>
          <View style={[styles.dot, i === activeIndex && styles.dotActive]} />
        </Pressable>)}
      </View>
      <Text style={styles.hint}>Swipe for alternatives</Text>
    </View> : null}
    <Modal visible={preview !== null} animationType="slide" onRequestClose={() => { if (!saving) setPreview(null); }}>
      <SafeAreaView style={styles.summaryScreen}>
        <ScrollView contentContainerStyle={styles.summaryContent}>
          <View style={styles.summaryHeader}>
            <Text accessibilityRole="header" style={styles.routeText}>Your journey</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close journey details" disabled={saving} onPress={() => setPreview(null)} style={styles.close}><Text style={styles.link}>✕</Text></Pressable>
          </View>
          {preview ? <View style={styles.card}>
            <Text style={styles.routeText}>{preview.journey.departureLocation} → {preview.journey.arrivalLocation}</Text>
            <Text style={styles.text}>{dateLabel(preview.journey.departureAt)}</Text>
            <Text style={styles.summaryMode}>{modes[preview.journey.mode]} · {preview.label}</Text>
            <Text style={styles.duration}>{duration(preview.journey.departureAt, preview.journey.arrivalAt)}</Text>
            <Text style={styles.price}>Estimated {money(preview.journey.cost)} <Text style={styles.text}>/ person</Text></Text>
            <View style={styles.schedule}>
              <View style={styles.timeColumn}><Text style={styles.text}>Departure</Text><Text style={styles.mode}>{timeLabel(preview.journey.departureAt)}</Text><Text style={styles.muted}>{dateLabel(preview.journey.departureAt)}</Text></View>
              <View style={styles.timeColumn}><Text style={styles.text}>Arrival</Text><Text style={styles.mode}>{timeLabel(preview.journey.arrivalAt)}</Text><Text style={styles.muted}>{dateLabel(preview.journey.arrivalAt)}</Text></View>
            </View>
            <Text style={styles.muted}>Times are local to each location.</Text>
            <View style={styles.fareNotice}><Text style={styles.text}>Fare shown is an estimate.</Text><Text style={styles.muted}>Check current prices and availability before booking.</Text></View>
            {preview.journey.bookingLink ? <Pressable accessibilityRole="link" onPress={() => void open(preview.journey.bookingLink!)} style={styles.linkButton}><Text style={styles.link}>View live fares ↗</Text></Pressable> : null}
            {saveError ? <Text accessibilityRole="alert" style={styles.error}>{saveError}</Text> : null}
            <AppButton label="Save journey" disabled={busy} loading={saving} onPress={() => void saveJourney()} />
          </View> : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </View>;
}
export const journeyTheme = StyleSheet.create({
  panel: { gap: spacing.lg },
  text: { color: colors.textMuted, fontSize: typography.body, lineHeight: 23 },
  link: { color: colors.sky, fontSize: typography.small, fontWeight: '700', lineHeight: 20 },
});
const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  route: { gap: spacing.xs, marginBottom: spacing.xs },
  routeText: { color: colors.ink, fontWeight: '800', fontSize: 21, lineHeight: 28 },
  text: journeyTheme.text,
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm, minHeight: 230 },
  recommended: { borderColor: colors.sky },
  badge: { alignSelf: 'flex-start', backgroundColor: colors.background, color: colors.textMuted, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: spacing.sm },
  recommendedBadge: { color: colors.sky, backgroundColor: colors.surfaceTint },
  mode: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  duration: { color: colors.ink, fontSize: 34, lineHeight: 42, fontWeight: '800', letterSpacing: -1 },
  price: { color: colors.ink, fontSize: 20, fontWeight: '800', lineHeight: 28 },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  dotTarget: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 7, height: 7, backgroundColor: colors.border, borderRadius: radius.pill },
  dotActive: { width: 22, backgroundColor: colors.sky },
  hint: { color: colors.textMuted, fontSize: typography.small, textAlign: 'center' },
  explanation: { gap: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.leaf, paddingLeft: spacing.lg, marginTop: spacing.xs },
  explanationTitle: { color: colors.ink, fontSize: typography.body, fontWeight: '800' },
  muted: { color: colors.textMuted, fontSize: typography.small, lineHeight: 19 },
  cardAction: { marginTop: spacing.lg },
  summaryScreen: { flex: 1, backgroundColor: colors.background },
  summaryContent: { padding: spacing.lg, gap: spacing.lg, width: '100%', maxWidth: 560, alignSelf: 'center' },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  summaryMode: { color: colors.ink, fontSize: 17, fontWeight: '700', marginTop: spacing.lg },
  schedule: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.xl },
  timeColumn: { flex: 1, minWidth: 100, gap: spacing.sm },
  fareNotice: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg, marginTop: spacing.lg, gap: spacing.xs },
  error: { color: colors.danger, fontSize: typography.body, lineHeight: 23 },
  linkButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  link: { ...journeyTheme.link, fontSize: typography.body },
});
