import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ItineraryState, StoredItinerary } from '../../../packages/contracts/src/itinerary';
import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { generateItinerary, generationOperationKey, loadItineraryState } from '@/features/itinerary/service';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { createUuid } from '@/lib/uuid';

type Props = { tripId: string; onBack: () => void; onReview?: () => void; loadAction?: typeof loadItineraryState; generateAction?: typeof generateItinerary; slowAfterMs?: number };

export function ItineraryScreen({ tripId, onBack, onReview, loadAction = loadItineraryState, generateAction = generateItinerary, slowAfterMs = 30_000 }: Props) {
  const [state, setState] = useState<ItineraryState | null>(null); const [version, setVersion] = useState<StoredItinerary | null>(null);
  const [operationKey, setOperationKey] = useState<string | null>(null); const [loading, setLoading] = useState(true); const [generating, setGenerating] = useState(false); const [slow, setSlow] = useState(false); const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const next = await loadAction(tripId); setState(next); setVersion(next.latest);
      if (next.operation?.status === 'pending') {
        setOperationKey(next.operation.idempotencyKey);
        setSlow(Date.now() - Date.parse(next.operation.startedAt) >= slowAfterMs);
      } else if (next.operation?.status === 'failed') {
        setOperationKey(next.operation.idempotencyKey); setError(next.operation.error); setSlow(true);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not restore the itinerary.'); }
    finally { setLoading(false); }
  }, [loadAction, slowAfterMs, tripId]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const run = useCallback(async (requestedKey?: string) => {
    const key = requestedKey ?? await generationOperationKey(tripId);
    const sequence = ++requestSequence.current; setOperationKey(key); setGenerating(true); setSlow(false); setError(null);
    const timer = setTimeout(() => { if (requestSequence.current === sequence) setSlow(true); }, slowAfterMs);
    try {
      const result = await generateAction(tripId, key);
      if (requestSequence.current === sequence) { setVersion(result.version); setSlow(false); await refresh(); }
    } catch (cause) {
      if (requestSequence.current === sequence) { setError(cause instanceof Error ? cause.message : 'Could not generate the itinerary.'); setSlow(true); }
    } finally {
      clearTimeout(timer); if (requestSequence.current === sequence) setGenerating(false);
    }
  }, [generateAction, refresh, slowAfterMs, tripId]);

  if (loading && !state) return <Screen scroll={false}><View style={styles.center}><Text style={styles.title}>Restoring itinerary…</Text></View></Screen>;
  if (!state) return <Screen scroll={false}><View style={styles.center}><Text accessibilityRole="alert" style={styles.error}>{error ?? 'The itinerary is unavailable.'}</Text><View style={styles.action}><AppButton label="Try again" onPress={() => void refresh()} /></View></View></Screen>;
  const locked = state.lockedDestination;
  const retryKey = operationKey ?? createUuid();
  return <Screen footer={locked && !version ? <View style={styles.footer}>
    {!generating ? <AppButton label="Generate itinerary" onPress={() => void run()} testID="generate-itinerary" /> : null}
    {slow ? <AppButton label="Retry same request" onPress={() => void run(retryKey)} testID="retry-itinerary" variant="secondary" /> : null}
  </View> : undefined} testID="itinerary-screen">
    <Pressable accessibilityRole="button" onPress={onBack}><Text style={styles.back}>‹ Destination vote</Text></Pressable>
    <Text style={styles.kicker}>AI ITINERARY</Text><Text style={styles.title}>{locked ? locked.name : 'Destination required'}</Text>
    {!locked ? <View style={styles.notice} testID="destination-required"><Text style={styles.sectionTitle}>Lock a destination first</Text><Text style={styles.body}>Generation stays unavailable until the group has locked its final destination.</Text></View> : null}
    {generating ? <View style={styles.notice} testID="itinerary-progress"><Text style={styles.sectionTitle}>{slow ? 'Still building your draft…' : 'Building a practical draft…'}</Text><Text accessibilityLiveRegion="polite" style={styles.body}>{slow ? 'This is taking longer than 30 seconds. You can safely retry with the same request; it will not create a duplicate version.' : 'Checking group inputs, travel blocks, estimates, and hard constraints before anything is saved.'}</Text>{slow ? <View style={styles.action}><AppButton label="Retry same request" onPress={() => void run(retryKey)} testID="retry-itinerary-inline" variant="secondary" /></View> : null}</View> : null}
    {error ? <View style={styles.errorBox}><Text accessibilityRole="alert" style={styles.error}>{error}</Text>{locked ? <View style={styles.action}><AppButton label="Retry same request" onPress={() => void run(retryKey)} testID="retry-itinerary-error" variant="secondary" /></View> : null}</View> : null}
    {version ? <View testID="stored-itinerary">
      <View style={styles.meta}><Text style={styles.metaText}>VERSION {version.version}</Text><Text style={styles.metaText}>{new Date(version.generatedAt).toLocaleString()}</Text></View>
      <Text style={styles.summary}>{version.itinerary.summary}</Text>
      {version.itinerary.warnings.map((warning) => <Text key={warning} style={styles.warning}>⚠ {warning}</Text>)}
      <View style={styles.days}>{version.itinerary.days.map((day) => <View key={day.dayNumber} style={styles.day}>
        <Text style={styles.dayLabel}>DAY {day.dayNumber}{day.date ? ` · ${day.date}` : ''}</Text><Text style={styles.dayTitle}>{day.title}</Text>
        <View style={styles.activities}>{day.activities.map((activity) => <View key={activity.activityId} style={styles.activity} testID={`activity-${activity.activityId}`}>
          <View style={styles.activityHeader}><Text style={styles.time}>{activity.timeBlock.start}–{activity.timeBlock.end}</Text><Text style={styles.confidence}>{activity.confidence.level.toUpperCase()} · {activity.confidence.score}%</Text></View>
          <Text style={styles.activityTitle}>{activity.title}</Text><Text style={styles.location}>{activity.location.name}{activity.location.address ? ` · ${activity.location.address}` : ''}</Text><Text style={styles.body}>{activity.description}</Text>
          <Text style={styles.estimate}>{activity.estimate.currency} {activity.estimate.minimum}–{activity.estimate.maximum} · {activity.estimate.basis.replace('_', ' ')}</Text>
          <View style={styles.rationale}><Text style={styles.rationaleLabel}>WHY IT FITS THE GROUP</Text><Text style={styles.body}>{activity.rationale.explanation}</Text></View>
          {activity.warnings.map((warning) => <Text key={warning} style={styles.warning}>⚠ {warning}</Text>)}
          <Text style={styles.source}>Sources as of {activity.sourceTimestamps.map((item) => new Date(item).toLocaleDateString()).join(', ')}</Text>
        </View>)}</View>
      </View>)}</View>
      <Text style={styles.source}>Draft confidence: {version.itinerary.confidence.level} ({version.itinerary.confidence.score}%). Verify opening hours, availability, prices, and accessibility directly before booking.</Text>
      {onReview ? <View style={styles.action}><AppButton label="Review, revise & share" onPress={onReview} testID="review-itinerary" /></View> : null}
    </View> : locked && !generating ? <Text style={styles.intro}>Generate a schema-checked draft shaped by the group’s shared input. Private member details are not shown in explanations.</Text> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: spacing.xl }, action: { marginTop: spacing.lg, width: '100%' }, footer: { gap: spacing.md }, back: { color: colors.sky, fontSize: typography.body, marginBottom: spacing.xl }, kicker: { color: colors.coral, fontSize: typography.label, fontWeight: '900', letterSpacing: 1.5 }, title: { color: colors.white, fontSize: typography.title, fontWeight: '900', marginTop: spacing.sm }, intro: { color: colors.textMuted, fontSize: typography.body, lineHeight: 24, marginTop: spacing.lg },
  notice: { backgroundColor: colors.midnightRaised, borderColor: colors.sky, borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm, marginTop: spacing.xl, padding: spacing.xl }, sectionTitle: { color: colors.white, fontSize: typography.heading, fontWeight: '900' }, body: { color: colors.textMuted, fontSize: typography.small, lineHeight: 20 }, errorBox: { backgroundColor: colors.midnightRaised, borderColor: colors.danger, borderRadius: radius.lg, borderWidth: 1, marginTop: spacing.xl, padding: spacing.lg }, error: { color: colors.danger, fontSize: typography.small, lineHeight: 20, textAlign: 'center' },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xl }, metaText: { color: colors.gold, fontSize: 10, fontWeight: '900' }, summary: { color: colors.sand, fontSize: typography.body, lineHeight: 24, marginTop: spacing.md }, warning: { color: colors.gold, fontSize: typography.small, lineHeight: 20, marginTop: spacing.sm }, days: { gap: spacing.xxl, marginTop: spacing.xxl }, day: { gap: spacing.sm }, dayLabel: { color: colors.coral, fontSize: typography.label, fontWeight: '900', letterSpacing: 1.2 }, dayTitle: { color: colors.white, fontSize: typography.heading, fontWeight: '900' }, activities: { gap: spacing.md, marginTop: spacing.md }, activity: { backgroundColor: colors.midnightRaised, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm, padding: spacing.lg }, activityHeader: { flexDirection: 'row', justifyContent: 'space-between' }, time: { color: colors.sky, fontSize: typography.small, fontWeight: '900' }, confidence: { color: colors.textMuted, fontSize: 10, fontWeight: '900' }, activityTitle: { color: colors.white, fontSize: typography.heading, fontWeight: '900' }, location: { color: colors.sand, fontSize: typography.small }, estimate: { color: colors.gold, fontSize: typography.small, fontWeight: '800' }, rationale: { borderLeftColor: colors.coral, borderLeftWidth: 2, gap: spacing.xs, marginTop: spacing.sm, paddingLeft: spacing.md }, rationaleLabel: { color: colors.coral, fontSize: 10, fontWeight: '900' }, source: { color: colors.textMuted, fontSize: 10, lineHeight: 16, marginTop: spacing.lg },
});
