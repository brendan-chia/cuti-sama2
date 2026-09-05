import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { StoredItinerary } from '../../../packages/contracts/src/itinerary';
import type { ItineraryRevisionState } from '../../../packages/contracts/src/revision';
import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { estimateLabel } from '@/features/itinerary-revision/estimate-label';
import { activateItinerary, loadItineraryVersion, loadRevisionState } from '@/features/itinerary-revision/service';
import { ItineraryTopBar } from '@/features/itinerary/itinerary-chrome';
import { activityPhotoUrl, photoFallbackUrl } from '@/features/itinerary/remote-photos';
import { colors, radius, spacing, typography } from '@/theme/tokens';

type Props = {
  tripId: string;
  version: string;
  initialDay?: number;
  onBack: () => void;
  onRevise: () => void;
  onVersion: (version: number) => void;
  loadAction?: typeof loadRevisionState;
  loadVersionAction?: typeof loadItineraryVersion;
  activateAction?: typeof activateItinerary;
};

type Activity = StoredItinerary['itinerary']['days'][number]['activities'][number];
const toMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
const durationLabel = (activity: Activity) => {
  const minutes = toMinutes(activity.timeBlock.end) - toMinutes(activity.timeBlock.start);
  const hours = Math.floor(minutes / 60); const rest = minutes % 60;
  return hours ? `${hours}h${rest ? ` ${rest}m` : ''}` : `${rest}m`;
};

function RemoteActivityImage({ activity, destination }: { activity: Activity; destination: string }) {
  const primary = useMemo(() => activityPhotoUrl(destination, activity.title, activity.tags), [activity.tags, activity.title, destination]);
  const fallback = useMemo(() => photoFallbackUrl(`${destination}-${activity.activityId}`), [activity.activityId, destination]);
  const [failed, setFailed] = useState(false); const uri = failed ? fallback : primary;
  return <Image accessibilityLabel={`${activity.title} in ${destination}`} cachePolicy="memory-disk" contentFit="cover" onError={() => setFailed(true)} source={uri} style={styles.photo} transition={200} />;
}

export function ItineraryVersionScreen({ tripId, version, initialDay = 1, onBack, onRevise, onVersion, loadAction = loadRevisionState, loadVersionAction = loadItineraryVersion, activateAction = activateItinerary }: Props) {
  const [state, setState] = useState<ItineraryRevisionState | null>(null); const [displayed, setDisplayed] = useState<StoredItinerary | null>(null);
  const [selectedDay, setSelectedDay] = useState(initialDay); const [loading, setLoading] = useState(true); const [activating, setActivating] = useState(false); const [error, setError] = useState<string | null>(null);
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
  const day = displayed.itinerary.days.find((item) => item.dayNumber === selectedDay) ?? displayed.itinerary.days[0];
  const currencies = new Set(day.activities.map((item) => item.estimate.currency));
  const totals = day.activities.reduce((value, item) => ({ currency: currencies.size === 1 ? item.estimate.currency : null, minimum: value.minimum + item.estimate.minimum, maximum: value.maximum + item.estimate.maximum }), { currency: null as string | null, minimum: 0, maximum: 0 });

  return <Screen contentStyle={styles.content} testID="itinerary-version-screen">
    <ItineraryTopBar compact onBack={onBack} title={displayed.itinerary.destination.name} />
    <ScrollView contentContainerStyle={styles.dayTabs} horizontal showsHorizontalScrollIndicator={false}>
      {displayed.itinerary.days.map((item) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: item.dayNumber === day.dayNumber }} key={item.dayNumber} onPress={() => setSelectedDay(item.dayNumber)} style={[styles.dayTab, item.dayNumber === day.dayNumber ? styles.dayTabActive : null]} testID={`day-tab-${item.dayNumber}`}><Text style={[styles.dayTabTitle, item.dayNumber === day.dayNumber ? styles.dayTabTitleActive : null]}>Day {item.dayNumber}</Text><Text style={[styles.dayTabDate, item.dayNumber === day.dayNumber ? styles.dayTabDateActive : null]}>{item.date ? item.date.slice(5).replace('-', '/') : `Plan ${item.dayNumber}`}</Text></Pressable>)}
    </ScrollView>
    <View style={styles.main} testID={`day-${day.dayNumber}`}>
      <Text style={styles.dayLabel}>DAY {day.dayNumber}{day.date ? ` · ${day.date}` : ''}</Text>
      <View style={styles.dayHeading}><Text style={styles.dayTitle}>{day.title}</Text><View style={styles.priceBadge}><Text style={styles.priceBadgeText}>{estimateLabel(totals)}</Text></View></View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <View style={styles.activities}>{day.activities.map((activity) => <View key={activity.activityId} style={styles.activity}>
        <View style={styles.timeRail}><Text style={styles.time}>{activity.timeBlock.start}</Text><View style={styles.timeDash} /><Text style={styles.time}>{activity.timeBlock.end}</Text></View>
        <View style={styles.activityCard}>
          <View style={styles.activityCopy}><Text style={styles.activityTitle}>{activity.title}</Text><Text numberOfLines={1} style={styles.location}>{activity.location.name}</Text><Text numberOfLines={3} style={styles.body}>{activity.description}</Text><View style={styles.activityMeta}><Text style={styles.metaItem}>⌁ {activity.tags[0] ?? activity.rationale.groupSignal}</Text><Text style={styles.metaItem}>◷ {durationLabel(activity)}</Text></View></View>
          <RemoteActivityImage activity={activity} destination={displayed.itinerary.destination.name} key={`${displayed.itinerary.destination.name}-${activity.activityId}-${activity.title}`} />
        </View>
      </View>)}</View>

      <Text style={styles.sectionLabel}>Notes</Text>
      <View style={styles.note}><Text style={styles.noteIcon}>▣</Text><Text style={styles.noteText}>{day.activities.flatMap((item) => item.warnings)[0] ?? displayed.itinerary.confidence.reason}</Text></View>
      <View style={styles.budget}><Text style={styles.budgetTitle}>Budget summary</Text><View style={styles.budgetRow}><Text style={styles.budgetLabel}>Estimated range</Text><Text style={styles.budgetValue}>{estimateLabel(totals)}</Text></View><View style={styles.budgetTrack}><View style={styles.budgetFill} /></View></View>

      {!organizer ? <View style={styles.notice} testID="member-readonly"><Text style={styles.noticeTitle}>Shared by your organiser</Text><Text style={styles.body}>This itinerary is read-only for group members.</Text></View> : null}
      {organizer && isActive ? <View style={styles.action}><AppButton label="Revise this itinerary" onPress={onRevise} testID="revise-itinerary" /></View> : null}
      {organizer && !isActive && state.active ? <View style={styles.action}><AppButton label="Restore this version" onPress={() => void restore()} loading={activating} testID="restore-version" variant="secondary" /></View> : null}

      <View style={styles.history}><Text style={styles.sectionTitle}>Version history</Text>{state.history.map((item) => <Pressable accessibilityRole="button" key={item.versionId} onPress={() => onVersion(item.version)} style={[styles.historyRow, item.active ? styles.activeRow : null]} testID={`history-version-${item.version}`}><Text style={styles.historyTitle}>Version {item.version}{item.active ? ' · Active' : ''}</Text><Text style={styles.body}>{item.instruction ? item.instruction.kind.replace('_', ' ') : 'Original generated draft'}</Text></Pressable>)}</View>
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 0, paddingTop: 0 }, back: { color: colors.sky, fontSize: typography.body, marginBottom: spacing.xl }, title: { color: colors.ink, fontSize: typography.title, fontWeight: '900' },
  dayTabs: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md }, dayTab: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, minWidth: 58, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm }, dayTabActive: { backgroundColor: colors.sand, borderColor: colors.sand }, dayTabTitle: { color: colors.ink, fontSize: 10, fontWeight: '800' }, dayTabTitleActive: { color: colors.background }, dayTabDate: { color: colors.textMuted, fontSize: 8, marginTop: 3 }, dayTabDateActive: { color: colors.disabled },
  main: { paddingBottom: spacing.xxl, paddingHorizontal: spacing.md }, dayLabel: { color: colors.sky, fontSize: 10, fontWeight: '800', letterSpacing: .7, marginTop: spacing.sm }, dayHeading: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between', marginTop: spacing.sm }, dayTitle: { color: colors.sky, flex: 1, fontSize: typography.heading, fontWeight: '900' }, priceBadge: { backgroundColor: colors.surface, borderColor: colors.gold, borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.sm, paddingVertical: 4 }, priceBadgeText: { color: colors.gold, fontSize: 8, fontWeight: '800' },
  activities: { gap: spacing.sm, marginTop: spacing.lg }, activity: { flexDirection: 'row' }, timeRail: { alignItems: 'center', paddingVertical: spacing.sm, width: 48 }, time: { color: colors.sky, fontSize: 9, fontWeight: '800' }, timeDash: { backgroundColor: colors.border, flex: 1, marginVertical: 4, width: 1 }, activityCard: { backgroundColor: colors.surface, borderRadius: radius.md, flex: 1, flexDirection: 'row', minHeight: 128, overflow: 'hidden', padding: spacing.md }, activityCopy: { flex: 1, paddingRight: spacing.sm }, activityTitle: { color: colors.ink, fontSize: 12, fontWeight: '900' }, location: { color: colors.sky, fontSize: 9, marginTop: 3 }, body: { color: colors.textMuted, fontSize: 10, lineHeight: 15, marginTop: 5 }, activityMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: 'auto', paddingTop: spacing.sm }, metaItem: { color: colors.sky, fontSize: 8 }, photo: { backgroundColor: colors.surfaceTint, borderRadius: radius.sm, height: 104, width: 82 },
  sectionLabel: { color: colors.sky, fontSize: 11, fontWeight: '800', marginTop: spacing.lg }, note: { alignItems: 'flex-start', backgroundColor: colors.surface, borderRadius: radius.sm, flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, padding: spacing.md }, noteIcon: { color: colors.sky, fontSize: 13 }, noteText: { color: colors.textMuted, flex: 1, fontSize: 10, lineHeight: 15 }, budget: { backgroundColor: colors.surface, borderRadius: radius.sm, marginTop: spacing.md, padding: spacing.md }, budgetTitle: { color: colors.sky, fontSize: 11, fontWeight: '800' }, budgetRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }, budgetLabel: { color: colors.textMuted, fontSize: 9 }, budgetValue: { color: colors.sky, fontSize: 9, fontWeight: '900' }, budgetTrack: { backgroundColor: colors.border, borderRadius: radius.pill, height: 5, marginTop: spacing.sm, overflow: 'hidden' }, budgetFill: { backgroundColor: colors.sand, borderRadius: radius.pill, height: 5, width: '62%' },
  notice: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, marginTop: spacing.lg, padding: spacing.md }, noticeTitle: { color: colors.ink, fontSize: typography.body, fontWeight: '800' }, action: { marginTop: spacing.lg }, history: { gap: spacing.sm, marginTop: spacing.xxl }, sectionTitle: { color: colors.ink, fontSize: typography.heading, fontWeight: '900' }, historyRow: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, gap: spacing.xs, padding: spacing.md }, activeRow: { borderColor: colors.sky }, historyTitle: { color: colors.ink, fontSize: typography.body, fontWeight: '800' }, error: { color: colors.danger, fontSize: typography.small, lineHeight: 20, marginTop: spacing.lg },
});
