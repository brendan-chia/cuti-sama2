import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { AvailabilitySchema, DatePreferencesSchema, type DatePreferences, type QuestAction, type QuestRoom, type TripPeriod } from '../../../packages/contracts/src/quest';
import { AppButton } from '@/components/app-button';
import { nextCalendarDate, useCurrentDate } from '@/lib/current-date';
import { DateField } from '@/components/date-field';
import { questStyles as s } from './quest-styles';
import { colors, radius, spacing } from '@/theme/tokens';

export function periodLabel(period: Pick<TripPeriod, 'startsOn' | 'endsOn'>) {
  const format = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${format(period.startsOn)} – ${format(period.endsOn)}`;
}
const defaults = () => DatePreferencesSchema.parse({});
// Compare calendar values, not JSON property or selection order.
function proposalKey(startsOn: string, endsOn: string, preferences: DatePreferences) {
  return JSON.stringify([
    startsOn, endsOn, preferences.flexibility,
    [...preferences.daysOff].sort((a, b) => a - b),
    preferences.unavailable.map((range) => `${range.startsOn}:${range.endsOn}`).sort(),
  ]);
}
const flexibilityOptions = [['exact', 'Exact dates'], ['3', 'Within 3 days'], ['7', 'Within a week'], ['month', 'Same start month']] as const;
type Props = { room: QuestRoom; busy: boolean; act: (action: QuestAction) => Promise<boolean>; recommend: () => Promise<void> };
export function TimingStage({ room, busy, act, recommend }: Props) {
  const [startsOn, setStartsOn] = useState(room.ownAvailability?.startsOn ?? '');
  const [endsOn, setEndsOn] = useState(room.ownAvailability?.endsOn ?? '');
  const [preferences, setPreferences] = useState<DatePreferences>(room.ownDatePreferences ?? defaults());
  const [blockedStart, setBlockedStart] = useState(''); const [blockedEnd, setBlockedEnd] = useState('');
  const [showProposals, setShowProposals] = useState(false); const [showAlternatives, setShowAlternatives] = useState(false);
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);
  const submitted = room.members.filter((member) => member.availabilitySubmitted).length;
  const allReady = submitted === room.members.length;
  const days = (Date.parse(endsOn) - Date.parse(startsOn)) / 86400000 + 1;
  const today = useCurrentDate();
  const earliestStart = nextCalendarDate(today);
  const valid = AvailabilitySchema.safeParse({ startsOn, endsOn }).success && startsOn > today && days >= 1 && days <= 30;
  const savedPreferences = room.ownDatePreferences ?? defaults();
  const savedStart = room.ownAvailability?.startsOn ?? '';
  const savedEnd = room.ownAvailability?.endsOn ?? '';
  const savedKey = proposalKey(savedStart, savedEnd, savedPreferences);
  const draftKey = proposalKey(startsOn, endsOn, preferences);
  const previousSavedKey = useRef(savedKey);
  useEffect(() => {
    if (previousSavedKey.current === savedKey) return;
    // Adopt a refreshed saved proposal only when the user has not edited this form.
    if (draftKey === previousSavedKey.current) {
      setStartsOn(savedStart); setEndsOn(savedEnd); setPreferences(savedPreferences);
    }
    previousSavedKey.current = savedKey;
  }, [draftKey, savedKey, savedStart, savedEnd, savedPreferences]);
  const dirty = draftKey !== savedKey;
  const pendingBlock = Boolean(blockedStart || blockedEnd);
  const validBlock = AvailabilitySchema.safeParse({ startsOn: blockedStart, endsOn: blockedEnd }).success && blockedEnd >= blockedStart;
  const recommendation = room.dateRecommendation;
  const nameFor = (id: string) => `${room.members.find((member) => member.memberId === id)?.displayName ?? 'Traveller'}${id === room.currentMemberId ? ' (you)' : ''}`;
  if (room.travelParty === 'solo') return <View style={s.panel}>
    <Text style={s.heading}>When would you like to travel?</Text>
    <Text style={s.body}>Choose a start date from tomorrow onwards, then pick your destination.</Text>
    <DateField label="Start date" minimumDate={earliestStart} required value={startsOn} onChange={setStartsOn} />
    <DateField label="End date" rangeStart={startsOn} required value={endsOn} minimumDate={startsOn && startsOn > earliestStart ? startsOn : earliestStart} onChange={setEndsOn} />
    {startsOn && endsOn && !valid ? <Text style={s.error}>Choose a future trip of 1–30 days.</Text> : null}
    <AppButton label="Confirm my dates" testID="save-quest-availability" loading={busy} disabled={!valid} onPress={() => void act({ type: 'availability', startsOn, endsOn, preferences: { flexibility: 'exact', daysOff: [], unavailable: [] } })} />
  </View>;
  return <View style={s.stack}>
    <View style={s.panel}>
      <Text style={s.heading}>Which dates would you propose?</Text>
      <Text style={s.small}>Share your preferred period. We’ll combine everyone’s preferences, flexibility and Malaysian national holidays into a recommendation.</Text>
      <DateField label="Proposed start date" minimumDate={earliestStart} required value={startsOn} onChange={setStartsOn} />
      <DateField label="Proposed end date" rangeStart={startsOn} required value={endsOn} minimumDate={startsOn && startsOn > earliestStart ? startsOn : earliestStart} onChange={setEndsOn} />
      <Text style={s.strong}>How flexible is your start date?</Text>
      <View style={s.row}>{flexibilityOptions.map(([value, label]) => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={label} aria-checked={preferences.flexibility === value} aria-disabled={busy} accessibilityState={{ checked: preferences.flexibility === value, disabled: busy }} disabled={busy} style={[s.chip, preferences.flexibility === value && s.chipSelected]} onPress={() => setPreferences({ ...preferences, flexibility: value })}><Text style={[s.chipText, preferences.flexibility === value && s.chipTextSelected]}>{label}</Text></Pressable>)}</View>
      <Text style={s.small}>We keep a proposed trip length where possible and show any length changes before you confirm.</Text>
      <Text style={s.strong}>Your usual days off</Text>
      <View style={s.row}>{[1, 2, 3, 4, 5, 6, 0].map((index) => { const label = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][index]; return <Pressable key={label} accessibilityRole="checkbox" accessibilityLabel={`${label} off`} aria-checked={preferences.daysOff.includes(index)} aria-disabled={busy} accessibilityState={{ checked: preferences.daysOff.includes(index), disabled: busy }} disabled={busy} style={[s.chip, preferences.daysOff.includes(index) && s.chipSelected]} onPress={() => setPreferences({ ...preferences, daysOff: (preferences.daysOff.includes(index) ? preferences.daysOff.filter((day) => day !== index) : [...preferences.daysOff, index]).sort() })}><Text style={[s.chipText, preferences.daysOff.includes(index) && s.chipTextSelected]}>{label}</Text></Pressable>; })}</View>
      <Text style={s.strong}>Dates you cannot travel (optional)</Text>
      <Text style={s.small}>These dates are private. Recommendations will never overlap them.</Text>
      {preferences.unavailable.map((range, index) => <View key={`${range.startsOn}-${index}`}><Text style={s.small}>{periodLabel(range)}</Text><AppButton label={`Remove unavailable range ${index + 1}`} variant="secondary" disabled={busy} onPress={() => setPreferences({ ...preferences, unavailable: preferences.unavailable.filter((_, position) => position !== index) })} /></View>)}
      {preferences.unavailable.length < 20 ? <>
        <DateField label="Unavailable from" value={blockedStart} onChange={setBlockedStart} />
        <DateField label="Unavailable until" rangeStart={blockedStart} value={blockedEnd} minimumDate={blockedStart || undefined} onChange={setBlockedEnd} />
        <AppButton label="Add unavailable dates" variant="secondary" disabled={busy || !validBlock} onPress={() => { setPreferences({ ...preferences, unavailable: [...preferences.unavailable, { startsOn: blockedStart, endsOn: blockedEnd }] }); setBlockedStart(''); setBlockedEnd(''); }} />
      </> : null}
      {pendingBlock ? <Text style={s.small}>Add this unavailable range or clear both fields before saving.</Text> : null}
      {room.ownAvailability ? <Text style={s.small}>Your saved proposal: {periodLabel(room.ownAvailability)}</Text> : null}
      <AppButton label={room.ownAvailability ? 'Update my proposed dates' : 'Submit my proposed dates'} testID="save-quest-availability" loading={busy} disabled={!valid || pendingBlock} onPress={() => void act({ type: 'availability', startsOn, endsOn, preferences })} />
      {startsOn && endsOn && !valid ? <Text style={s.error}>Choose a future trip of 1–30 days.</Text> : null}
    </View>
    <Text accessibilityLiveRegion="polite" style={s.body}>{allReady ? 'Everyone has proposed dates. Let’s find a period for your crew.' : `${submitted} of ${room.members.length} proposals received. Everyone’s dates will appear once the whole crew submits.`}</Text>
    {allReady ? <View style={s.stack}>
      {dirty || pendingBlock ? <Text style={s.small}>Save your changes before finding or confirming shared dates.</Text> : null}
      {!recommendation ? room.currentRole === 'organizer' ? <AppButton label="Find our best dates" testID="suggest-trip-periods" loading={busy} disabled={dirty || pendingBlock} onPress={() => void recommend()} /> : <Text style={s.body}>The organiser can now find dates for your crew. The recommendation will appear here for everyone.</Text> : <>
        <Text style={s.heading}>{recommendation.periods.length ? 'Recommended for your crew' : 'Let’s adjust the preferences'}</Text>
        <Text style={s.body}>{recommendation.message}</Text>
        <Text style={s.small}>{recommendation.calendarNotice}</Text>
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://www.kabinet.gov.my/hari-kelepasan-am/')}><Text style={s.link}>Official Malaysian holiday calendar ↗</Text></Pressable>
        {recommendation.periods.filter((_, index) => index === 0 || showAlternatives).map((period, index) => <View style={[styles.card, index === 0 && styles.recommended]} key={`${period.startsOn}:${period.endsOn}`}>
          <View style={styles.header}>
            <Text style={styles.eyebrow}>{index === 0 ? 'Your best shared dates' : 'Another option'}</Text>
            <Text style={styles.duration}>{period.durationDays} {period.durationDays === 1 ? 'day' : 'days'} away</Text>
          </View>
          <Text style={styles.dates}>{periodLabel(period)}</Text>
          <View style={styles.leave}>
          <Text style={s.strong}>Annual leave to request</Text>
          {period.travellers.map((traveller) => <View key={traveller.memberId} style={styles.traveller}>
            <View style={styles.person}>
              <Text style={styles.name}>{nameFor(traveller.memberId)}</Text>
              <Text style={s.small}>{traveller.shiftDays === 0 ? 'Same proposed start' : `Starts ${Math.abs(traveller.shiftDays)} ${Math.abs(traveller.shiftDays) === 1 ? 'day' : 'days'} ${traveller.shiftDays < 0 ? 'earlier' : 'later'}`}{traveller.durationChange ? ` · ${Math.abs(traveller.durationChange)} ${Math.abs(traveller.durationChange) === 1 ? 'day' : 'days'} ${traveller.durationChange < 0 ? 'shorter' : 'longer'}` : ''}</Text>
            </View>
            <Text style={styles.count}>{traveller.leaveDays === 0 ? 'No leave' : `${traveller.leaveDays} ${traveller.leaveDays === 1 ? 'day' : 'days'}`}</Text>
          </View>)}
          </View>
          <Pressable accessibilityRole="button" aria-expanded={expandedPeriod === `${period.startsOn}:${period.endsOn}`} accessibilityState={{ expanded: expandedPeriod === `${period.startsOn}:${period.endsOn}` }} style={({ pressed }) => [styles.disclosure, pressed && { opacity: 0.65 }]} onPress={() => setExpandedPeriod(expandedPeriod === `${period.startsOn}:${period.endsOn}` ? null : `${period.startsOn}:${period.endsOn}`)}>
            <Text style={styles.detailLabel}>{expandedPeriod === `${period.startsOn}:${period.endsOn}` ? 'Hide details' : 'View leave dates & details'}</Text>
            <Text style={styles.detailLabel}>{expandedPeriod === `${period.startsOn}:${period.endsOn}` ? '−' : '+'}</Text>
          </Pressable>
          {expandedPeriod === `${period.startsOn}:${period.endsOn}` ? <View style={styles.details}>
            <Text style={s.body}>{period.reason}</Text>
            <Text style={s.small}>Leave estimates include usual days off and Malaysian national holidays.</Text>
            {period.holidays.map((holiday) => <Text key={`${holiday.date}:${holiday.name}`} style={s.small}>{holiday.name} · {holiday.date}</Text>)}
            {period.travellers.map((traveller) => <View key={traveller.memberId} style={styles.person}>
              <Text style={s.strong}>{nameFor(traveller.memberId)}</Text>
              <Text style={styles.detailText}>{traveller.leaveDays === 0 ? 'No annual leave needed.' : traveller.leaveDates ? traveller.leaveDates.map((date) => new Date(`${date}T12:00:00`).toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })).join(' · ') : 'Refresh the trip to load the specific leave dates.'}</Text>
            </View>)}
          </View> : null}
          {room.currentRole === 'organizer' ? <View style={styles.footer}><AppButton label="Confirm these dates" testID={`confirm-recommendation-${index}`} disabled={busy || dirty || pendingBlock} onPress={() => void act({ type: 'period', period: { startsOn: period.startsOn, endsOn: period.endsOn, label: period.label, reason: period.reason } })} /><Text style={styles.next}>Next, build your wishlists together.</Text></View> : <Text style={s.small}>Review these dates together. Your organiser confirms the group’s choice.</Text>}
        </View>)}
        {recommendation.periods.length > 1 ? <AppButton label={showAlternatives ? 'Hide alternatives' : 'Compare alternatives'} variant="secondary" onPress={() => setShowAlternatives(!showAlternatives)} /> : null}
      </>}
      <AppButton label={showProposals ? 'Hide original proposals' : 'View original proposals'} variant="secondary" onPress={() => setShowProposals(!showProposals)} />
      {showProposals ? <View style={s.stack} testID="date-proposals">{(room.dateProposals ?? []).map((proposal) => <View key={proposal.memberId} style={s.panel}><Text style={s.strong}>{nameFor(proposal.memberId)}</Text><Text style={s.body}>{periodLabel(proposal)}</Text></View>)}</View> : null}
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.lg },
  recommended: { backgroundColor: colors.surfaceTint },
  header: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  eyebrow: { color: colors.sky, fontSize: 14, fontWeight: '600' },
  duration: { color: colors.textMuted, fontSize: 13 },
  dates: { color: colors.ink, fontSize: 24, fontWeight: '800', lineHeight: 32, letterSpacing: -0.5 },
  leave: { gap: spacing.lg, paddingTop: spacing.sm },
  traveller: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  person: { flex: 1, gap: spacing.xs },
  name: { color: colors.ink, fontSize: 15, fontWeight: '500' },
  count: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  disclosure: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  detailLabel: { color: colors.sky, fontSize: 14, fontWeight: '600' },
  details: { gap: spacing.md },
  detailText: { color: colors.textMuted, fontSize: 13, lineHeight: 22 },
  footer: { gap: spacing.sm },
  next: { color: colors.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
