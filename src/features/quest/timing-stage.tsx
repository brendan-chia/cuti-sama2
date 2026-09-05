import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type { QuestAction, QuestRoom, TripPeriod } from '../../../packages/contracts/src/quest';
import { AppButton } from '@/components/app-button';
import { DateField } from '@/components/date-field';
import { suggestTripPeriods } from './timing';
import { questStyles as s } from './quest-styles';

export function periodLabel(period: Pick<TripPeriod, 'startsOn' | 'endsOn'>) {
  const format = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${format(period.startsOn)} – ${format(period.endsOn)}`;
}

type Props = { room: QuestRoom; busy: boolean; act: (action: QuestAction) => Promise<boolean>; suggestAction?: typeof suggestTripPeriods };
export function TimingStage({ room, busy, act, suggestAction = suggestTripPeriods }: Props) {
  const [startsOn, setStartsOn] = useState(room.ownAvailability?.startsOn ?? '');
  const [endsOn, setEndsOn] = useState(room.ownAvailability?.endsOn ?? '');
  const duration = 5;
  const [result, setResult] = useState<{ key: string; data: Awaited<ReturnType<typeof suggestTripPeriods>> } | null>(null);
  const [loadingRequest, setLoadingRequest] = useState<{ key: string; version: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const allReady = room.members.every((member) => member.availabilitySubmitted);
  const organizer = room.currentRole === 'organizer';
  const requestVersion = useRef(0);
  const availabilityKey = `${allReady}:${room.sharedAvailability?.startsOn}:${room.sharedAvailability?.endsOn}:${duration}`;
  const suggestions = result?.key === availabilityKey ? result.data : null;
  const loading = loadingRequest?.key === availabilityKey;
  useEffect(() => { requestVersion.current += 1; }, [availabilityKey]);
  useEffect(() => () => { requestVersion.current += 1; }, []);

  async function suggest() {
    const version = ++requestVersion.current;
    setLoadingRequest({ key: availabilityKey, version }); setError(null);
    try {
      const next = await suggestAction(room.tripId, duration);
      if (version === requestVersion.current) setResult({ key: availabilityKey, data: next });
    } catch (cause) { if (version === requestVersion.current) setError(cause instanceof Error ? cause.message : 'Could not suggest travel dates. Try again.'); }
    finally { setLoadingRequest((current) => current?.version === version ? null : current); }
  }

  return <View style={s.stack}>
    <View style={s.panel}>
      <Text style={s.heading}>When could you get away?</Text>
      <Text style={s.small}>Add your available date range. We’ll find a trip inside the window everyone shares.</Text>
      <DateField label="Available from" required value={startsOn} onChange={setStartsOn} />
      <DateField label="Available until" required value={endsOn} minimumDate={startsOn || undefined} onChange={setEndsOn} />
      {room.ownAvailability ? <Text style={s.small}>Saved: {periodLabel(room.ownAvailability)}</Text> : null}
      <AppButton label={room.ownAvailability ? 'Update my availability' : 'Save my availability'} testID="save-quest-availability" loading={busy} disabled={!startsOn || !endsOn || startsOn > endsOn} onPress={() => void act({ type: 'availability', startsOn, endsOn })} />
      {startsOn && endsOn && startsOn > endsOn ? <Text style={s.error}>Your end date must be on or after your start date.</Text> : null}
    </View>
    {allReady && !room.sharedAvailability ? <View style={s.success}><Text style={s.heading}>Let’s make some room.</Text><Text style={s.body}>Your available dates don’t overlap yet. Compare calendars together and update your availability above.</Text></View> : null}
    {organizer ? <View style={s.stack}>
      <AppButton label="Find our best travel windows" testID="suggest-trip-periods" disabled={!allReady || !room.sharedAvailability || busy} loading={loading} onPress={() => void suggest()} />
      <Text style={s.small}>{allReady ? 'AI can help rank feasible dates. Calendar suggestions are available if AI is unavailable. Dates use your shared availability and a Monday–Friday work week.' : 'Date suggestions unlock once everyone saves their availability.'}</Text>
    </View> : <Text style={s.body}>{allReady ? 'The organiser can now find and choose a travel window for the group.' : 'Once everyone shares their availability, the organiser can reveal suggested travel windows.'}</Text>}
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    {suggestions ? <View style={s.stack}>
      <Text style={s.kicker}>{suggestions.source === 'groq' ? 'AI-RANKED TRAVEL WINDOWS' : 'CALENDAR TRAVEL WINDOWS'}</Text>
      <Text accessibilityLiveRegion="polite" style={s.body}>{suggestions.message}</Text>
      {suggestions.periods.map((period, index) => <View key={`${period.startsOn}:${period.endsOn}`} style={s.panel}>
        <Text style={s.kicker}>{index === 0 ? 'TOP PICK' : `OPTION ${index + 1}`} · {duration} DAYS</Text>
        <Text style={s.heading}>{periodLabel(period)}</Text><Text style={s.strong}>{period.label}</Text><Text style={s.body}>{period.reason}</Text>
        <AppButton label="Lock these dates & unlock wishlists" loading={busy} onPress={() => void act({ type: 'period', period })} />
      </View>)}
    </View> : null}
  </View>;
}
