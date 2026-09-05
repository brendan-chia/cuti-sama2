import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { AvailabilitySchema, DatePreferencesSchema, type DatePreferences, type QuestAction, type QuestRoom, type TripPeriod } from '../../../packages/contracts/src/quest';
import { AppButton } from '@/components/app-button';
import { DateField } from '@/components/date-field';
import { questStyles as s } from './quest-styles';

export function periodLabel(period: Pick<TripPeriod, 'startsOn' | 'endsOn'>) {
  const format = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${format(period.startsOn)} – ${format(period.endsOn)}`;
}
const defaults = () => DatePreferencesSchema.parse({});
const flexibilityOptions = [['exact', 'Exact dates'], ['3', 'Within 3 days'], ['7', 'Within a week'], ['month', 'Same start month']] as const;
type Props = { room: QuestRoom; busy: boolean; act: (action: QuestAction) => Promise<boolean>; recommend: () => Promise<void> };
export function TimingStage({ room, busy, act, recommend }: Props) {
  const [startsOn, setStartsOn] = useState(room.ownAvailability?.startsOn ?? '');
  const [endsOn, setEndsOn] = useState(room.ownAvailability?.endsOn ?? '');
  const [preferences, setPreferences] = useState<DatePreferences>(room.ownDatePreferences ?? defaults());
  const [blockedStart, setBlockedStart] = useState(''); const [blockedEnd, setBlockedEnd] = useState('');
  const [showProposals, setShowProposals] = useState(false); const [showAlternatives, setShowAlternatives] = useState(false);
  const submitted = room.members.filter((member) => member.availabilitySubmitted).length;
  const allReady = submitted === room.members.length;
  const days = (Date.parse(endsOn) - Date.parse(startsOn)) / 86400000 + 1;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const valid = AvailabilitySchema.safeParse({ startsOn, endsOn }).success && startsOn > today && days >= 1 && days <= 30;
  const dirty = startsOn !== room.ownAvailability?.startsOn || endsOn !== room.ownAvailability?.endsOn || JSON.stringify(preferences) !== JSON.stringify(room.ownDatePreferences ?? defaults());
  const pendingBlock = Boolean(blockedStart || blockedEnd);
  const validBlock = AvailabilitySchema.safeParse({ startsOn: blockedStart, endsOn: blockedEnd }).success && blockedEnd >= blockedStart;
  const recommendation = room.dateRecommendation;
  const nameFor = (id: string) => `${room.members.find((member) => member.memberId === id)?.displayName ?? 'Traveller'}${id === room.currentMemberId ? ' (you)' : ''}`;
  return <View style={s.stack}>
    <View style={s.panel}>
      <Text style={s.heading}>Which dates would you propose?</Text>
      <Text style={s.small}>Share your preferred period. We’ll combine everyone’s preferences, flexibility and Malaysian national holidays into a recommendation.</Text>
      <DateField label="Proposed start date" required value={startsOn} onChange={setStartsOn} />
      <DateField label="Proposed end date" required value={endsOn} minimumDate={startsOn || undefined} onChange={setEndsOn} />
      <Text style={s.strong}>How flexible is your start date?</Text>
      <View style={s.row}>{flexibilityOptions.map(([value, label]) => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: preferences.flexibility === value, disabled: busy }} disabled={busy} style={[s.chip, preferences.flexibility === value && s.chipSelected]} onPress={() => setPreferences({ ...preferences, flexibility: value })}><Text style={[s.chipText, preferences.flexibility === value && s.chipTextSelected]}>{label}</Text></Pressable>)}</View>
      <Text style={s.small}>We keep a proposed trip length where possible and show any length changes before you confirm.</Text>
      <Text style={s.strong}>Your usual days off</Text>
      <View style={s.row}>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, index) => <Pressable key={label} accessibilityRole="checkbox" accessibilityLabel={`${label} off`} accessibilityState={{ checked: preferences.daysOff.includes(index), disabled: busy }} disabled={busy} style={[s.chip, preferences.daysOff.includes(index) && s.chipSelected]} onPress={() => setPreferences({ ...preferences, daysOff: (preferences.daysOff.includes(index) ? preferences.daysOff.filter((day) => day !== index) : [...preferences.daysOff, index]).sort() })}><Text style={[s.chipText, preferences.daysOff.includes(index) && s.chipTextSelected]}>{label}</Text></Pressable>)}</View>
      <Text style={s.strong}>Dates you cannot travel (optional)</Text>
      <Text style={s.small}>These dates are private. Recommendations will never overlap them.</Text>
      {preferences.unavailable.map((range, index) => <View key={`${range.startsOn}-${index}`}><Text style={s.small}>{periodLabel(range)}</Text><AppButton label={`Remove unavailable range ${index + 1}`} variant="secondary" disabled={busy} onPress={() => setPreferences({ ...preferences, unavailable: preferences.unavailable.filter((_, position) => position !== index) })} /></View>)}
      {preferences.unavailable.length < 20 ? <>
        <DateField label="Unavailable from" value={blockedStart} onChange={setBlockedStart} />
        <DateField label="Unavailable until" value={blockedEnd} minimumDate={blockedStart || undefined} onChange={setBlockedEnd} />
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
        {recommendation.periods.filter((_, index) => index === 0 || showAlternatives).map((period, index) => <View style={index === 0 ? s.success : s.panel} key={`${period.startsOn}:${period.endsOn}`}>
          <Text style={s.kicker}>{index === 0 ? 'BEST SHARED PERIOD' : 'ALTERNATIVE'}</Text>
          <Text style={s.heading}>{periodLabel(period)}</Text><Text style={s.strong}>{period.durationDays} days</Text>
          <Text style={s.body}>{period.reason}</Text>
          {period.holidays.map((holiday) => <Text key={`${holiday.date}:${holiday.name}`} style={s.small}>{holiday.name} · {holiday.date}</Text>)}
          {period.travellers.map((traveller) => <Text key={traveller.memberId} style={s.small}>{nameFor(traveller.memberId)}: {traveller.leaveDays} estimated leave days · {traveller.shiftDays === 0 ? 'same start' : `${Math.abs(traveller.shiftDays)} days ${traveller.shiftDays < 0 ? 'earlier' : 'later'}`}{traveller.durationChange ? ` · ${Math.abs(traveller.durationChange)} days ${traveller.durationChange < 0 ? 'shorter' : 'longer'}` : ''}</Text>)}
          {room.currentRole === 'organizer' ? <AppButton label="Confirm these dates & unlock wishlists" testID={`confirm-recommendation-${index}`} disabled={busy || dirty || pendingBlock} onPress={() => void act({ type: 'period', period: { startsOn: period.startsOn, endsOn: period.endsOn, label: period.label, reason: period.reason } })} /> : <Text style={s.small}>Review these dates together. Your organiser confirms the group’s choice.</Text>}
        </View>)}
        {recommendation.periods.length > 1 ? <AppButton label={showAlternatives ? 'Hide alternatives' : 'Compare alternatives'} variant="secondary" onPress={() => setShowAlternatives(!showAlternatives)} /> : null}
      </>}
      <AppButton label={showProposals ? 'Hide original proposals' : 'View original proposals'} variant="secondary" onPress={() => setShowProposals(!showProposals)} />
      {showProposals ? <View style={s.stack} testID="date-proposals">{(room.dateProposals ?? []).map((proposal) => <View key={proposal.memberId} style={s.panel}><Text style={s.strong}>{nameFor(proposal.memberId)}</Text><Text style={s.body}>{periodLabel(proposal)}</Text></View>)}</View> : null}
    </View> : null}
  </View>;
}
