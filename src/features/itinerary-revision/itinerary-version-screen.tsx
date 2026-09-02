import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { StoredItinerary } from '../../../packages/contracts/src/itinerary';
import type { ItineraryRevisionState } from '../../../packages/contracts/src/revision';
import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { estimateLabel } from '@/features/itinerary-revision/estimate-label';
import { activateItinerary, loadItineraryVersion, loadRevisionState } from '@/features/itinerary-revision/service';
import { colors, radius, spacing, typography } from '@/theme/tokens';

type Props = { tripId: string; version: string; onBack: () => void; onRevise: () => void; onVersion: (version: number) => void; loadAction?: typeof loadRevisionState; loadVersionAction?: typeof loadItineraryVersion; activateAction?: typeof activateItinerary };

export function ItineraryVersionScreen({ tripId, version, onBack, onRevise, onVersion, loadAction = loadRevisionState, loadVersionAction = loadItineraryVersion, activateAction = activateItinerary }: Props) {
  const [state, setState] = useState<ItineraryRevisionState | null>(null); const [displayed, setDisplayed] = useState<StoredItinerary | null>(null);
  const [loading, setLoading] = useState(true); const [activating, setActivating] = useState(false); const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const next = await loadAction(tripId); setState(next);
      const requested = version === 'latest' ? next.active : await loadVersionAction(tripId, Number(version));
      setDisplayed(requested);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load itinerary history.'); }
    finally { setLoading(false); }
  }, [loadAction, loadVersionAction, tripId, version]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const restore = useCallback(async () => {
    if (!state?.active || !displayed) return; setActivating(true); setError(null);
    try { await activateAction(tripId, displayed.versionId, state.active.versionId); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not restore this version.'); }
    finally { setActivating(false); }
  }, [activateAction, displayed, refresh, state, tripId]);
  if (loading && !state) return <Screen><Text style={styles.title}>Restoring the latest itinerary…</Text></Screen>;
  if (!state || !displayed) return <Screen><Pressable onPress={onBack}><Text style={styles.back}>‹ Itinerary</Text></Pressable><Text accessibilityRole="alert" style={styles.error}>{error ?? 'No active itinerary is available.'}</Text></Screen>;
  const organizer = state.currentRole === 'organizer'; const isActive = state.active?.versionId === displayed.versionId;
  return <Screen testID="itinerary-version-screen">
    <Pressable accessibilityRole="button" onPress={onBack}><Text style={styles.back}>‹ Trip itinerary</Text></Pressable>
    <Text style={styles.kicker}>{isActive ? 'ACTIVE · SHARED READ-ONLY' : 'VERSION HISTORY'}</Text>
    <Text style={styles.title}>{displayed.itinerary.destination.name}</Text>
    <View style={styles.meta}><Text style={styles.metaText}>VERSION {displayed.version}</Text><Text style={styles.metaText}>{new Date(displayed.generatedAt).toLocaleString()}</Text></View>
    {!organizer ? <View style={styles.notice} testID="member-readonly"><Text style={styles.noticeTitle}>Shared by your organiser</Text><Text style={styles.body}>Members can review every day and estimate. Editing and activation stay with the organiser in this release.</Text></View> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <Text style={styles.summary}>{displayed.itinerary.summary}</Text>
    {displayed.itinerary.days.map((day) => {
      const currencies = new Set(day.activities.map((item) => item.estimate.currency));
      const totals = day.activities.reduce((value, item) => ({ currency: currencies.size === 1 ? item.estimate.currency : null, minimum: value.minimum + item.estimate.minimum, maximum: value.maximum + item.estimate.maximum }), { currency: null as string | null, minimum: 0, maximum: 0 });
      return <View key={day.dayNumber} style={styles.day} testID={`day-${day.dayNumber}`}><Text style={styles.dayLabel}>DAY {day.dayNumber}{day.date ? ` · ${day.date}` : ''}</Text><Text style={styles.dayTitle}>{day.title}</Text><Text style={styles.dayEstimate}>{estimateLabel(totals)}</Text>
        {day.activities.map((activity) => <View key={activity.activityId} style={styles.activity}><Text style={styles.time}>{activity.timeBlock.start}–{activity.timeBlock.end}</Text><Text style={styles.activityTitle}>{activity.title}</Text><Text style={styles.location}>{activity.location.name}</Text><Text style={styles.body}>{activity.description}</Text><Text style={styles.price}>{activity.estimate.currency} {activity.estimate.minimum}–{activity.estimate.maximum}</Text></View>)}
      </View>;
    })}
    {organizer && isActive ? <View style={styles.action}><AppButton label="Revise this itinerary" onPress={onRevise} testID="revise-itinerary" /></View> : null}
    {organizer && !isActive && state.active ? <View style={styles.action}><AppButton label="Restore this version" onPress={() => void restore()} loading={activating} testID="restore-version" variant="secondary" /></View> : null}
    <View style={styles.history}><Text style={styles.sectionTitle}>Version history</Text>{state.history.map((item) => <Pressable accessibilityRole="button" key={item.versionId} onPress={() => onVersion(item.version)} style={[styles.historyRow, item.active ? styles.activeRow : null]} testID={`history-version-${item.version}`}><Text style={styles.historyTitle}>Version {item.version}{item.active ? ' · Active' : ''}</Text><Text style={styles.body}>{item.instruction ? item.instruction.kind.replace('_', ' ') : 'Original generated draft'}</Text></Pressable>)}</View>
  </Screen>;
}

const styles = StyleSheet.create({
  back: { color: colors.sky, fontSize: typography.body, marginBottom: spacing.xl }, kicker: { color: colors.coral, fontSize: typography.label, fontWeight: '900', letterSpacing: 1.4 }, title: { color: colors.white, fontSize: typography.title, fontWeight: '900', marginTop: spacing.sm }, meta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md }, metaText: { color: colors.gold, fontSize: 10, fontWeight: '900' }, notice: { backgroundColor: colors.midnightRaised, borderColor: colors.sky, borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm, marginTop: spacing.xl, padding: spacing.lg }, noticeTitle: { color: colors.white, fontSize: typography.heading, fontWeight: '900' }, body: { color: colors.textMuted, fontSize: typography.small, lineHeight: 20 }, summary: { color: colors.sand, fontSize: typography.body, lineHeight: 24, marginTop: spacing.xl }, day: { gap: spacing.sm, marginTop: spacing.xxl }, dayLabel: { color: colors.coral, fontSize: typography.label, fontWeight: '900' }, dayTitle: { color: colors.white, fontSize: typography.heading, fontWeight: '900' }, dayEstimate: { color: colors.gold, fontSize: typography.small, fontWeight: '800' }, activity: { backgroundColor: colors.midnightRaised, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, gap: spacing.xs, marginTop: spacing.sm, padding: spacing.lg }, time: { color: colors.sky, fontSize: typography.small, fontWeight: '900' }, activityTitle: { color: colors.white, fontSize: typography.body, fontWeight: '800' }, location: { color: colors.sand, fontSize: typography.small }, price: { color: colors.gold, fontSize: typography.small, fontWeight: '800' }, action: { marginTop: spacing.xl }, history: { gap: spacing.md, marginTop: spacing.hero }, sectionTitle: { color: colors.white, fontSize: typography.heading, fontWeight: '900' }, historyRow: { borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, gap: spacing.xs, padding: spacing.lg }, activeRow: { borderColor: colors.coral }, historyTitle: { color: colors.white, fontSize: typography.body, fontWeight: '800' }, error: { color: colors.danger, fontSize: typography.small, lineHeight: 20, marginTop: spacing.lg },
});
