import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { QuestRoom } from '../../../packages/contracts/src/quest';
import { emptyLogistics, logisticsTotals } from '../../../packages/contracts/src/logistics';
import type { TripModeData, TripModeState } from '../../../packages/contracts/src/trip-mode';
import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { loadQuest } from '@/features/quest/service';
import { planQuest, questPlaces } from '@/features/quest/planner-input';
import { placeLabel } from '@/lib/presentation';
import { colors, radius, spacing } from '@/theme/tokens';
import { rescueDay, type Disruption, type Rescue } from './rescue';
import { loadTripMode, saveTripMode } from './service';

const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export function TripModeScreen({ tripId, onBack, startWithRescue = false, backLabel = 'Back to itinerary', loadRoom = loadQuest, loadAction = loadTripMode, saveAction = saveTripMode }: {
  tripId: string; onBack: () => void; startWithRescue?: boolean; backLabel?: string; loadRoom?: typeof loadQuest; loadAction?: typeof loadTripMode; saveAction?: typeof saveTripMode;
}) {
  const [room, setRoom] = useState<QuestRoom | null>(null);
  const [state, setState] = useState<TripModeState | null>(null);
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [rescuing, setRescuing] = useState(false), [reason, setReason] = useState<Disruption | null>(null);
  const [target, setTarget] = useState(''), [delay, setDelay] = useState(30);
  const [proposal, setProposal] = useState<Rescue | null>(null), [noMatch, setNoMatch] = useState(false);
  const epoch = useRef(0), saving = useRef(false);
  const refresh = useCallback(async () => {
    const request = ++epoch.current;
    setLoading(true); setError(''); setProposal(null); setRescuing(false);
    // Do not retain an old crew's state if route identity changes or access is revoked.
    setRoom(null); setState(null);
    try {
      const next = await loadRoom(tripId);
      if (next.stage !== 'complete') throw new Error('Generate your itinerary before opening Trip Mode.');
      const saved = await loadAction(tripId, next.revision);
      const data = saved.data ?? { days: planQuest(next).days, completedIds: [] };
      if (request !== epoch.current) return;
      setRoom(next); setState({ ...saved, data });
      if (startWithRescue) {
        const firstDay = data.days.find(d => d.date === localDate()) ?? data.days[0];
        setDate(firstDay.date);
        setTarget(firstDay.stops.find(stop => !data.completedIds.includes(stop.attractionId))?.attractionId ?? '');
        setReason(null); setNoMatch(false); setRescuing(true);
      }
      if (!startWithRescue) setDate(current => data.days.some(d => d.date === current) ? current : data.days.find(d => d.date === localDate())?.date ?? data.days[0].date);
    } catch (cause) { if (request === epoch.current) setError(cause instanceof Error ? cause.message : 'Could not load Trip Mode.'); }
    finally { if (request === epoch.current) setLoading(false); }
  }, [tripId, loadRoom, loadAction, startWithRescue]);
  useFocusEffect(useCallback(() => { void refresh(); return () => { epoch.current++; }; }, [refresh]));
  async function persist(data: TripModeData, message: string) {
    if (!room || !state || saving.current || room.currentRole !== 'organizer') return;
    saving.current = true; setBusy(true); setError('');
    const request = epoch.current;
    try {
      const saved = await saveAction(tripId, room.revision, state.revision, data);
      if (request !== epoch.current) return;
      setState(saved); setNotice(message); setRescuing(false); setProposal(null);
    } catch (cause) { if (request === epoch.current) setError(cause instanceof Error ? cause.message : 'Could not save changes.'); }
    finally { saving.current = false; if (request === epoch.current) setBusy(false); }
  }
  const data = state?.data;
  const day = data?.days.find(d => d.date === date);
  const places = room ? questPlaces(room) : [];
  const names = new Map(places.map(p => [p.id, placeLabel(p.name)]));
  const pending = day?.stops.filter(s => !data?.completedIds.includes(s.attractionId)) ?? [];
  const canEdit = room?.currentRole === 'organizer';
  function preview() {
    if (!room || !data || !reason) return;
    const totals = logisticsTotals(room.logistics ?? emptyLogistics, room.members.map(m => m.memberId), room.budgetSummary?.crewHardCeiling ?? 0);
    const result = rescueDay({ data, date, places, reason, targetId: target, delay, vibes: room.groupVibes,
      activityBudget: room.budgetSummary && !totals.draft ? totals.remaining : undefined });
    setProposal(result); setNoMatch(!result);
  }
  return <Screen testID="trip-mode-screen"><View style={s.stack}>
    <AppButton label={backLabel} variant="secondary" onPress={onBack} />
    <Text style={s.kicker}>TRIP MODE</Text><Text accessibilityRole="header" style={s.title}>{room?.tripName ?? 'Your trip, as it happens'}</Text>
    {loading ? <Text style={s.body}>Loading your shared day…</Text> : null}
    {error ? <View style={s.stack}><Text accessibilityRole="alert" style={s.error}>{error}</Text><AppButton label="Reload trip" variant="secondary" disabled={busy} onPress={() => void refresh()} /></View> : null}
    {notice ? <Text accessibilityLiveRegion="polite" style={s.success}>{notice}</Text> : null}
    {day && data ? <>
      <View style={s.dayPicker}>{data.days.map((d, i) => <Pressable key={d.date} accessibilityRole="button" accessibilityState={{ selected: date === d.date, disabled: busy }} disabled={busy} onPress={() => { setDate(d.date); setRescuing(false); setProposal(null); setNotice(''); }} style={[s.dayButton, d.date === date && s.dayActive]}><Text style={s.dayText}>Day {i + 1}</Text></Pressable>)}</View>
      <Text accessibilityRole="header" style={s.heading}>{date === localDate() ? 'TODAY · ' : ''}DAY {data.days.indexOf(day) + 1}</Text>
      <Text style={s.body}>{date} · {date === localDate() ? 'Today follows your device date' : 'Trip day preview'} · Suggested times</Text>
      <AppButton label="🚨 Plans changed" variant="secondary" disabled={busy || !pending.length} onPress={() => { setRescuing(true); setReason(null); setProposal(null); setNoMatch(false); setTarget(pending[0]?.attractionId ?? ''); }} />
      {!canEdit ? <Text style={s.body}>Explore a rescue below. Your organiser applies shared changes and marks stops complete.</Text> : null}
      {rescuing ? <View style={s.rescue}>
        <Text accessibilityRole="header" style={s.heading}>What happened?</Text>
        <View style={s.disruptionChoices}>{([['weather', 'Bad weather', '☂'], ['unavailable', 'Attraction unavailable', '⊘'], ['late', "We're running late", '◷']] as const).map(([value, label, icon]) => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: reason === value, disabled: busy }} disabled={busy} onPress={() => { setReason(value); setProposal(null); setNoMatch(false); }} style={({ pressed }) => [s.disruptionChoice, reason === value && s.disruptionSelected, busy && s.controlDisabled, pressed && s.controlPressed]}>
          <Text accessibilityElementsHidden aria-hidden style={[s.choiceIcon, reason === value && s.choiceSelectedText]}>{reason === value ? '✓' : icon}</Text><Text style={[s.choiceText, reason === value && s.choiceSelectedText]}>{label}</Text>
        </Pressable>)}</View>
        {reason === 'unavailable' ? <View style={s.stack}><Text style={s.body}>Which stop is unavailable?</Text>{pending.map(stop => <AppButton key={stop.attractionId} label={`${target === stop.attractionId ? '✓ ' : ''}${names.get(stop.attractionId) ?? stop.attractionId}`} variant="secondary" disabled={busy} onPress={() => { setTarget(stop.attractionId); setProposal(null); setNoMatch(false); }} />)}</View> : null}
        {reason === 'late' ? <View style={s.delaySection}><Text style={s.body}>How far behind are you?</Text><View style={s.delayChoices}>{[15, 30, 60, 90].map(n => <Pressable key={n} accessibilityRole="radio" accessibilityLabel={`${n} minutes`} accessibilityState={{ checked: delay === n, disabled: busy }} disabled={busy} onPress={() => { setDelay(n); setProposal(null); setNoMatch(false); }} style={({ pressed }) => [s.delayChoice, delay === n && s.delaySelected, busy && s.controlDisabled, pressed && s.controlPressed]}><Text style={[s.choiceText, delay === n && s.onSelectedDelay]}>{n} min</Text></Pressable>)}</View></View> : null}
        {reason ? <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={preview} style={({ pressed }) => [s.rescueAction, busy && s.controlDisabled, pressed && s.controlPressed]}><Text style={s.rescueActionText}>Rescue my day</Text></Pressable> : null}
        {noMatch ? <Text accessibilityRole="alert" style={s.body}>No suitable rescue fits this day with the available place data. Your plan is unchanged. Try another disruption or keep the current plan.</Text> : null}
        {proposal ? <View style={s.preview} testID="rescue-preview">
          <Text style={s.rescueBadge}>☼ Plan rescue</Text>
          <Text accessibilityRole="header" style={s.previewTitle}>{proposal.removed.length ? `${proposal.removed.length} ${proposal.removed.length === 1 ? 'stop needs' : 'stops need'} a replacement` : 'A little more breathing room'}</Text>
          {proposal.removed.map((id, i) => <View key={id} style={s.change}><Text style={s.kicker}>REMOVE</Text><Text style={s.body}>{names.get(id)}</Text><Text style={s.kicker}>ADD</Text><Text style={s.heading}>{names.get(proposal.added[i])}</Text></View>)}
          {proposal.reasons.map((text, i) => <View key={i} style={s.reasonRow}><Text accessibilityElementsHidden aria-hidden style={i === proposal.reasons.length - 1 ? s.reasonWarning : s.reasonIcon}>{i === proposal.reasons.length - 1 ? 'ⓘ' : i === 0 ? '→' : '✓'}</Text><Text style={s.reasonText}>{text}</Text></View>)}
          <View style={s.previewDivider} /><View style={s.costPanel}><Text style={s.costLabel}>Estimated activity cost change</Text><Text style={s.costAmount}>{proposal.budgetDelta == null ? 'Unknown' : `${proposal.budgetDelta > 0 ? '+' : proposal.budgetDelta < 0 ? '−' : ''}RM ${Math.abs(proposal.budgetDelta).toFixed(2)} / person`}</Text></View>
          <Text style={s.scheduleLabel}>Revised schedule</Text>
          <View>{proposal.day.stops.map((stop, index) => <View key={stop.attractionId} style={s.scheduleRow}>
            <View style={s.scheduleRail} accessibilityElementsHidden aria-hidden>{index < proposal.day.stops.length - 1 ? <View style={s.scheduleLine} /> : null}<View style={s.scheduleDot}><View style={s.scheduleDotCentre} /></View></View>
            <View style={s.scheduleCopy}><Text style={s.scheduleTime}>{stop.estimatedStartTime}–{stop.estimatedEndTime}</Text><Text style={s.schedulePlace}>{names.get(stop.attractionId) ?? stop.attractionId}</Text></View>
          </View>)}</View>
          <AppButton label="Use New Plan" disabled={!canEdit || busy} loading={busy} onPress={() => void persist({ ...data, days: data.days.map(d => d.date === date ? proposal.day : d) }, 'New plan saved for your crew.')} />
        </View> : null}
        <AppButton label="Keep current plan" variant="secondary" disabled={busy} onPress={() => { setRescuing(false); setProposal(null); }} />
      </View> : null}
      {!day.stops.length ? <Text style={s.body}>No scheduled stops today. Enjoy some free time.</Text> : null}
      {day.stops.map((stop, index) => {
        const done = data.completedIds.includes(stop.attractionId), next = pending[0]?.attractionId === stop.attractionId;
        return <View key={stop.attractionId} style={[s.stop, index % 2 === 1 && s.warm]}>
          <Text style={s.time}>{stop.estimatedStartTime}–{stop.estimatedEndTime}</Text><Text style={s.heading}>{names.get(stop.attractionId) ?? 'Saved place'}</Text>
          <Text style={done ? s.success : s.body}>{done ? '✓ Completed' : next ? 'Next' : 'Upcoming'}</Text>
          {canEdit ? <AppButton label={done ? 'Undo completion' : 'Mark completed'} variant="secondary" disabled={busy || (!done && !next)} onPress={() => void persist({ ...data, completedIds: done ? data.completedIds.filter(id => id !== stop.attractionId) : [...data.completedIds, stop.attractionId] }, done ? 'Completion undone.' : 'Stop completed.')} /> : null}
        </View>;
      })}
      {day.stops.length > 0 && !pending.length ? <Text style={s.success}>✓ Day complete. Enjoy the rest of your day.</Text> : null}
      <AppButton label="Refresh shared plan" variant="secondary" disabled={busy} onPress={() => void refresh()} />
    </> : null}
  </View></Screen>;
}
const s = StyleSheet.create({
  stack: { gap: spacing.md }, title: { color: colors.ink, fontSize: 28, lineHeight: 35, fontWeight: '800' },
  heading: { color: colors.ink, fontSize: 20, lineHeight: 28, fontWeight: '800' },
  kicker: { color: colors.gold, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  body: { color: colors.textMuted, fontSize: 15, lineHeight: 23 }, success: { color: colors.sky, fontSize: 15, lineHeight: 23, fontWeight: '700' },
  error: { color: colors.danger, fontSize: 15, lineHeight: 23 },
  stop: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm }, warm: { backgroundColor: colors.surfaceWarm },
  time: { color: colors.sky, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  rescue: { backgroundColor: colors.paper, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, gap: spacing.lg },
  disruptionChoices: { gap: spacing.sm },
  disruptionChoice: { minHeight: 48, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  disruptionSelected: { backgroundColor: colors.paper, borderColor: colors.sky },
  choiceIcon: { color: colors.coral, fontSize: 17, lineHeight: 24 },
  choiceText: { color: colors.ink, fontSize: 14, lineHeight: 22, fontWeight: '600', flexShrink: 1 },
  choiceSelectedText: { color: colors.sky },
  delaySection: { gap: spacing.sm, marginTop: spacing.sm },
  delayChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  delayChoice: { flexGrow: 1, flexBasis: 58, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  delaySelected: { backgroundColor: colors.sky, borderColor: colors.sky },
  onSelectedDelay: { color: colors.paper },
  rescueAction: { minHeight: 54, borderRadius: radius.pill, backgroundColor: colors.sky, alignItems: 'center', justifyContent: 'center', padding: spacing.md, marginTop: spacing.sm },
  rescueActionText: { color: colors.paper, fontSize: 15, lineHeight: 23, fontWeight: '700' },
  controlDisabled: { opacity: 0.45 },
  controlPressed: { opacity: 0.8 },
  preview: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: colors.coral, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  rescueBadge: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, color: colors.coral, fontSize: 13, lineHeight: 19 },
  previewTitle: { color: colors.ink, fontSize: 23, lineHeight: 31, fontWeight: '700' },
  reasonRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  reasonIcon: { color: colors.sky, fontSize: 15, lineHeight: 23 },
  reasonWarning: { color: colors.coral, fontSize: 15, lineHeight: 23 },
  reasonText: { flex: 1, color: colors.ink, fontSize: 14, lineHeight: 22 },
  previewDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.sm },
  costPanel: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, gap: spacing.xs },
  costLabel: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  costAmount: { color: colors.ink, fontSize: 20, lineHeight: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
  scheduleLabel: { color: colors.sky, fontSize: 13, lineHeight: 20, fontWeight: '600', marginTop: spacing.sm },
  scheduleRow: { flexDirection: 'row', gap: spacing.sm },
  scheduleRail: { width: 14, alignItems: 'center' },
  scheduleLine: { position: 'absolute', top: 10, bottom: -5, width: 1, backgroundColor: colors.border },
  scheduleDot: { width: 12, height: 12, marginTop: 5, borderRadius: 6, borderWidth: 1, borderColor: colors.coral, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  scheduleDotCentre: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.coral },
  scheduleCopy: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: spacing.md, rowGap: spacing.xs, paddingBottom: spacing.md },
  scheduleTime: { color: colors.coral, fontSize: 13, lineHeight: 22, fontVariant: ['tabular-nums'] },
  schedulePlace: { color: colors.ink, fontSize: 15, lineHeight: 22, fontWeight: '600', flexGrow: 1, flexBasis: 140 },
  change: { gap: spacing.sm, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  dayPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, dayButton: { minHeight: 44, paddingHorizontal: spacing.md, justifyContent: 'center', borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  dayActive: { backgroundColor: colors.leafSurface, borderColor: colors.sky }, dayText: { color: colors.ink, fontWeight: '700' },
});
