import { emptyLogistics, logisticsDraftNotice, logisticsTotals } from '../../../packages/contracts/src/logistics';
import { ItineraryDays } from '@/components/itinerary-days';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { QuestRoom } from '../../../packages/contracts/src/quest';
import { planQuest, questPlaces } from './planner-input';
import { questStyles as s } from './quest-styles';
import { colors, radius, spacing } from '@/theme/tokens';
import { estimatedDuration, placeLabel } from '@/lib/presentation';

export function ItineraryPlan({ room }: { room: QuestRoom }) {
  const [showNotes, setShowNotes] = useState(false);
  const result = useMemo(() => {
    try { return { plan: planQuest(room), error: null }; }
    catch (cause) { return { plan: null, error: cause instanceof Error ? cause.message : 'Could not build the trip.' }; }
  }, [room]);
  if (!result.plan) return <Text accessibilityRole="alert" style={s.error}>{result.error}</Text>;
  const plan = result.plan;
  const draft = logisticsTotals(room.logistics ?? emptyLogistics, room.members.map(member => member.memberId), room.budgetSummary?.crewHardCeiling ?? 0).draft;
  const names = new Map(questPlaces(room).map(place => [place.id, placeLabel(place.name)]));
  return <View style={s.stack} testID="deterministic-itinerary">
    <View style={styles.intro}><Text accessibilityRole="header" style={s.heading}>Your day-by-day trip</Text><Text style={styles.meta}>Suggested times. Adjust each day to your pace.</Text></View>
    {draft ? <Text style={s.small}>Draft itinerary · {logisticsDraftNotice}</Text> : null}
    <ItineraryDays>{plan.days.map((day, index) => <View key={day.date} style={styles.day}>
      <View style={styles.dayHeader}>
        <Text accessibilityRole="header" style={styles.dayTitle}>Day {index + 1}</Text>
        <Text style={styles.meta}>{new Date(day.date + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', weekday: 'short', timeZone: 'UTC' })}</Text>
      </View>
      <Text style={styles.summary}>{day.stops.length ? `${day.stops.length} ${day.stops.length === 1 ? 'stop' : 'stops'} · About ${estimatedDuration(day.estimatedScheduledMinutes)} planned` : 'A day to make your own'}</Text>
      {!day.stops.length ? <Text style={s.body}>Explore at your own pace or enjoy some downtime.</Text> : null}
      <View style={styles.timeline}>{day.stops.map(stop => <View key={stop.attractionId} style={styles.stop}>
        <View style={styles.rail} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden><View style={styles.railLine} /><View style={styles.dot}><View style={styles.dotCentre} /></View></View>
        <View style={styles.stopContent}>
          <Text style={styles.time}>{stop.estimatedStartTime} – {stop.estimatedEndTime}</Text>
          <Text style={styles.place}>{names.get(stop.attractionId) ?? 'Saved place'}</Text>
          <View style={styles.stopMeta}>
            <Text style={styles.meta}>◷ About {estimatedDuration(stop.estimatedVisitMinutes)}</Text>
            {stop.includedMealBreakMinutes ? <Text style={styles.meta}>☕ {estimatedDuration(stop.includedMealBreakMinutes)} meal break</Text> : null}
            {stop.estimatedTravelMinutesFromPrevious ? <Text style={styles.travel}>→ About {estimatedDuration(stop.estimatedTravelMinutesFromPrevious)} travel</Text> : null}
          </View>
        </View>
      </View>)}</View>
      {day.reservedMealBreakMinutes > 0 ? <Text style={styles.footnote}>☕ Includes {estimatedDuration(day.reservedMealBreakMinutes)} for a flexible meal break.</Text> : null}
    </View>)}</ItineraryDays>
    {plan.warnings.length ? <View>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: showNotes }} onPress={() => setShowNotes(current => !current)} style={styles.notesToggle}><Text style={styles.notesLabel}>{showNotes ? 'Hide planning notes −' : 'Planning notes +'}</Text></Pressable>
      {showNotes ? <View style={styles.notes}>{plan.warnings.map(warning => <Text key={warning} style={styles.meta}>{warning}</Text>)}</View> : null}
    </View> : null}
  </View>;
}
const styles = StyleSheet.create({
  intro: { gap: spacing.xs },
  day: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm },
  dayHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm },
  dayTitle: { color: colors.ink, fontSize: 24, lineHeight: 32, fontWeight: '700' },
  summary: { color: colors.sky, fontSize: 14, lineHeight: 22, paddingBottom: spacing.sm },
  timeline: { marginTop: spacing.md },
  stop: { flexDirection: 'row', gap: spacing.md },
  rail: { width: 14, alignItems: 'center' },
  railLine: { position: 'absolute', top: 10, bottom: 0, width: 1, backgroundColor: colors.border },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: colors.coral, backgroundColor: colors.paper, marginTop: 3, alignItems: 'center', justifyContent: 'center' },
  dotCentre: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.coral },
  stopContent: { flex: 1, minWidth: 0, paddingBottom: spacing.xl, gap: 2 },
  stopMeta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.sm, rowGap: 2 },
  travel: { color: colors.sky, fontSize: 13, lineHeight: 21 },
  time: { color: colors.coral, fontSize: 13, lineHeight: 20, fontWeight: '600', fontVariant: ['tabular-nums'] },
  place: { color: colors.ink, fontSize: 18, lineHeight: 26, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: 13, lineHeight: 21 },
  footnote: { color: colors.textMuted, fontSize: 13, lineHeight: 21, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  notesToggle: { minHeight: 44, justifyContent: 'center' },
  notesLabel: { color: colors.sky, fontSize: 14, lineHeight: 22, fontWeight: '600' },
  notes: { gap: spacing.sm, paddingVertical: spacing.sm },
});
