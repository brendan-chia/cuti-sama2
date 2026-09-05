import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { countryByCode } from '../../../packages/contracts/src/countries';
import type { QuestAction, QuestRoom } from '../../../packages/contracts/src/quest';
import { BrandLogo } from '@/components/brand-logo';
import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { FlightPath } from '@/components/flight-path';
import { PlaceImportPanel } from './place-import-panel';
import { colors, radius, spacing } from '@/theme/tokens';
import { AttractionMap } from './attraction-map';
import { BudgetStage, money } from './budget-stage';
import { CountryPicks } from './country-picks';
import { CountryVote } from './country-vote';
import { questStyles as s } from './quest-styles';
import { loadQuest, subscribeToQuest, updateQuest } from './service';
import { suggestTripPeriods } from './timing';
import { periodLabel, TimingStage } from './timing-stage';

export const questSteps = [
  { stage: 'timing', label: 'Dates', title: 'Propose your trip dates.', description: 'Share your preferred dates and days you cannot travel. Find a shared period with Malaysian national holidays in mind.' },
  { stage: 'picks', label: 'Wishlist', title: 'Where’s your heart set?', description: 'Play up to three favourite countries. Every traveller gets the same number of slots.' },
  { stage: 'voting', label: 'Vote', title: 'Swipe for your next stop.', description: 'One shared deck. One vote per country, per person. See where your group lands.' },
  { stage: 'explore', label: 'Explore', title: 'Pin the good stuff.', description: 'Your destination is decided. Explore the map together and let the organiser save your must-see stops.' },
  { stage: 'budget', label: 'Budget', title: 'Great memories. Happy wallets.', description: 'One last card to play. Find a spending ceiling everyone feels comfortable with.' },
] as const;

type Props = { tripId: string; onBack: () => void; onItinerary?: () => void; loadAction?: typeof loadQuest; updateAction?: typeof updateQuest; subscribeAction?: typeof subscribeToQuest; suggestAction?: typeof suggestTripPeriods };

function ExploreStage({ room, busy, act, onConfirmed }: { room: QuestRoom; busy: boolean; act: (action: QuestAction) => Promise<boolean>; onConfirmed: (room: QuestRoom) => void }) {
  const country = countryByCode(room.selectedCountryCode);
  const [selected, setSelected] = useState(room.attractionIds);
  if (!country) return <Text accessibilityRole="alert" style={s.error}>The selected country could not be loaded. Refresh the quest to try again.</Text>;
  const organizer = room.currentRole === 'organizer';
  const votes = room.results.find((result) => result.countryCode === country.code)?.agreeCount;
  const mapCountry = { ...country, attractions: [...country.attractions, ...(room.importedPlaces ?? []).map((place) => ({ ...place, category: 'From your crew', description: place.address }))] };
  return <View style={s.stack}>
    <View style={s.success}><Text style={s.kicker}>DESTINATION UNLOCKED</Text><Text style={s.title}>{country.flag} {country.name}</Text><Text style={s.body}>{votes !== undefined ? `${votes} of ${room.members.length} travellers voted yes. ` : ''}{country.tagline}</Text></View>
    <PlaceImportPanel tripId={room.tripId} countryName={country.name} disabled={busy} onConfirmed={onConfirmed} />
    <Text style={s.heading}>Your crew’s discovery map</Text>
    <AttractionMap country={mapCountry} selectedIds={organizer ? selected : room.attractionIds} onToggle={(id) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])} disabled={busy || !organizer} />
    {organizer ? <AppButton label={`Save ${selected.length || 'your'} ${selected.length === 1 ? 'stop' : 'stops'} & unlock budget`} testID="save-quest-attractions" disabled={!selected.length} loading={busy} onPress={() => void act({ type: 'attractions', attractionIds: selected })} /> : <Text style={s.body}>Explore the highlighted attractions while the organiser gathers your group’s choices. The saved stops will appear in your shared plan.</Text>}
  </View>;
}

function QuestSummary({ room, onItinerary }: { room: QuestRoom; onItinerary?: () => void }) {
  const country = countryByCode(room.selectedCountryCode);
  return <View style={s.stack}>
    <View style={styles.ticket}>
      <Text style={styles.ticketKicker}>CUTISAMA2 · YOUR GROUP’S PLAN</Text>
      <Text style={styles.ticketTitle}>{country?.flag} {country?.name}</Text>
      <Text style={styles.ticketBody}>{room.period ? periodLabel(room.period) : ''}</Text>
      <View style={styles.ticketDivider} />
      <Text style={styles.ticketKicker}>THE STOPS YOU PICKED</Text>
      {[...(country?.attractions ?? []), ...(room.importedPlaces ?? [])].filter((place) => room.attractionIds.includes(place.id)).map((place, index) => <Text key={place.id} style={styles.ticketBody}>{String(index + 1).padStart(2, '0')}  {place.name}</Text>)}
      <View style={styles.ticketDivider} />
      <Text style={styles.ticketKicker}>GROUP SPENDING CEILING</Text>
      <Text style={styles.ticketTitle}>{room.budgetSummary ? money(room.budgetSummary.comfortablePerPerson) : '—'}</Text>
      <Text style={styles.ticketBody}>per person · {room.members.length} travellers · whole trip</Text>
    </View>
    <Text style={s.body}>Five stops, one happy landing. Your dates, destination, places and budget are saved for everyone in the room.</Text>
    <Text style={s.body}>Turn your selected places into a day-by-day itinerary, with time for travel and meals, within your group’s budget.</Text>
    {onItinerary ? <AppButton label={room.currentRole === 'organizer' ? 'Generate our itinerary' : 'View our itinerary'} testID="open-quest-itinerary" onPress={onItinerary} /> : null}
  </View>;
}

export function QuestScreen({ tripId, onBack, onItinerary, loadAction = loadQuest, updateAction = updateQuest, subscribeAction = subscribeToQuest, suggestAction = suggestTripPeriods }: Props) {
  const [room, setRoom] = useState<QuestRoom | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const mutation = useRef(false);
  const refreshFailed = useRef(false);
  const alive = useRef(true);
  const accept = useCallback((next: QuestRoom) => {
    if (alive.current) setRoom((current) => current && current.revision > next.revision ? current : next);
  }, []);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const refresh = useCallback(async () => {
    try { const next = await loadAction(tripId); accept(next); if (alive.current) { setUnavailable(false); if (refreshFailed.current) setError(null); refreshFailed.current = false; } }
    catch (cause) { if (alive.current) { refreshFailed.current = true; setError(cause instanceof Error ? cause.message : 'Could not load the trip quest.'); setUnavailable(true); } }
  }, [accept, loadAction, tripId]);
  useFocusEffect(useCallback(() => {
    void refresh();
    // A light poll also recovers missed realtime events on weak mobile connections.
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, 15000);
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    let cleanup: (() => Promise<unknown>) | undefined; let active = true;
    void subscribeAction(tripId, () => void refresh()).then((unsubscribe) => { if (active) cleanup = unsubscribe; else void unsubscribe(); }).catch(() => { /* Focus refresh and polling remain available. */ });
    return () => { active = false; clearInterval(timer); listener.remove(); if (cleanup) void cleanup(); };
  }, [refresh, subscribeAction, tripId]));

  async function act(action: QuestAction) {
    if (mutation.current || unavailable) return false;
    mutation.current = true; setBusy(true); setError(null);
    try { accept(await updateAction(tripId, action)); return true; }
    catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : 'Your choice was not saved. Please try again.'); void refresh(); return false; }
    finally { mutation.current = false; if (alive.current) setBusy(false); }
  }

  async function recommend() {
    if (mutation.current || unavailable) return;
    mutation.current = true; setBusy(true); setError(null);
    try { accept(await suggestAction(tripId)); }
    catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : 'Could not recommend dates.'); void refresh(); }
    finally { mutation.current = false; if (alive.current) setBusy(false); }
  }

  if (!room) return <Screen><View style={s.stack}><Text style={s.title}>{error ? 'Your quest is waiting.' : 'Gathering your next adventure…'}</Text>{error ? <><Text accessibilityRole="alert" style={s.error}>{error}</Text><AppButton label="Try again" onPress={() => void refresh()} /></> : <Text style={s.body}>Opening the shared plan for your group.</Text>}<AppButton label="Back to the lobby" variant="secondary" onPress={onBack} /></View></Screen>;
  const completed = room.stage === 'complete';
  const voting = room.stage === 'voting';
  const index = completed ? 5 : questSteps.findIndex((step) => step.stage === room.stage);
  const step = questSteps[Math.min(index, 4)];
  const field = room.stage === 'timing' ? 'availabilitySubmitted' : room.stage === 'picks' ? 'picksSubmitted' : room.stage === 'voting' ? 'votesSubmitted' : room.stage === 'budget' ? 'budgetSubmitted' : null;
  const ready = field ? room.members.filter((member) => member[field]).length : room.members.length;
  return <Screen testID="trip-quest-screen">
    <View style={s.stack}>
      <View style={s.between}><Pressable accessibilityRole="button" onPress={onBack}><Text style={s.link}>‹ Trip lobby</Text></Pressable><BrandLogo compact /></View>
      {!voting ? <Text numberOfLines={1} style={s.small}>{room.tripName}</Text> : null}
      <FlightPath stage={index} />
      <View style={s.stack}>{!voting ? <Text style={s.kicker}>{completed ? 'QUEST COMPLETE' : `CHAPTER ${index + 1} · ${step.label.toUpperCase()}`}</Text> : null}<Text accessibilityRole="header" style={[s.title, voting && styles.compactTitle]}>{completed ? 'From group chat to game plan.' : step.title}</Text>{!voting ? <Text style={s.body}>{completed ? 'You made the big decisions. Together.' : step.description}</Text> : null}</View>
      {error ? <View style={s.success}><Text accessibilityRole="alert" style={s.error}>{error}</Text>{unavailable ? <AppButton label="Reconnect & refresh" variant="secondary" onPress={() => { setError(null); void refresh(); }} /> : <Pressable accessibilityRole="button" onPress={() => setError(null)}><Text style={s.link}>Dismiss</Text></Pressable>}</View> : null}
      {!completed ? <View><View style={s.between}><Text style={s.kicker}>YOUR TRAVEL CREW</Text><Text accessibilityLiveRegion="polite" style={s.small}>{field ? `${ready} / ${room.members.length} ready` : 'Explore together'}</Text></View>{!voting ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.crew}>
        {room.members.map((member) => { const done = field ? member[field] : true; return <View key={member.memberId} style={styles.traveller}><View style={[styles.avatar, done && styles.avatarReady]}><Text style={styles.avatarText}>{member.displayName.slice(0, 1).toUpperCase()}</Text>{done ? <Text style={styles.check}>✓</Text> : null}</View><Text style={styles.memberName} numberOfLines={1}>{member.memberId === room.currentMemberId ? 'You' : member.displayName}</Text></View>; })}
      </ScrollView> : null}</View> : null}
      {room.period && !completed && !voting ? <Text style={s.small}>✓ {periodLabel(room.period)}{room.selectedCountryCode ? ` · ${countryByCode(room.selectedCountryCode)?.name}` : ''}</Text> : null}
      {room.stage === 'timing' ? <TimingStage room={room} busy={busy || unavailable} act={act} recommend={recommend} /> : null}
      {room.stage === 'picks' ? <CountryPicks room={room} busy={busy || unavailable} act={act} /> : null}
      {room.stage === 'voting' ? <CountryVote room={room} busy={busy || unavailable} act={act} /> : null}
      {room.stage === 'explore' ? <ExploreStage room={room} busy={busy || unavailable} act={act} onConfirmed={accept} /> : null}
      {room.stage === 'budget' ? <BudgetStage room={room} busy={busy || unavailable} act={act} /> : null}
      {completed ? <QuestSummary room={room} onItinerary={onItinerary} /> : null}
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  compactTitle: { fontSize: 25, lineHeight: 30 },
  crew: { gap: spacing.lg, paddingVertical: spacing.md }, traveller: { alignItems: 'center', width: 54, gap: spacing.sm }, avatar: { height: 40, width: 40, backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, avatarReady: { borderColor: colors.sky }, avatarText: { color: colors.ink, fontWeight: '800' }, check: { color: colors.paper, backgroundColor: colors.sky, borderRadius: 9, fontSize: 9, width: 15, height: 15, textAlign: 'center', position: 'absolute', right: -4, bottom: -2 }, memberName: { color: colors.textMuted, fontSize: 10, maxWidth: 54 },
  ticket: { backgroundColor: colors.sand, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md }, ticketKicker: { color: colors.ink, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 }, ticketTitle: { color: colors.ink, fontSize: 32, fontWeight: '900', letterSpacing: -0.7 }, ticketBody: { color: colors.ink, fontSize: 14, lineHeight: 22 }, ticketDivider: { borderTopColor: colors.disabled, borderTopWidth: 1, borderStyle: 'dashed', marginVertical: spacing.sm },
});
