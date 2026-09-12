import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { countryByCode } from '../../../packages/contracts/src/countries';
import type { QuestAction, QuestRoom } from '../../../packages/contracts/src/quest';
import { emptyLogistics, logisticsTotals } from '../../../packages/contracts/src/logistics';
import { BrandLogo } from '@/components/brand-logo';
import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { FlightPath } from '@/components/flight-path';
import { PlaceImportPanel } from './place-import-panel';
import { colors, radius, spacing } from '@/theme/tokens';
import { AttractionMap } from './attraction-map';
import { LogisticsStage } from './logistics-stage';
import { BudgetStage, money } from './budget-stage';
import { CountryPicks } from './country-picks';
import { CrewChoices } from './crew-choices';
import { DestinationAnnouncement } from './destination-announcement';
import { CountryVote } from './country-vote';
import { questStyles as s } from './quest-styles';
import { loadQuest, subscribeToQuest, updateQuest } from './service';
import { suggestTripPeriods } from './timing';
import { periodLabel, TimingStage } from './timing-stage';

export const questSteps = [
  { stage: 'timing', label: 'Dates', title: 'Propose your trip dates.', description: 'Share your preferred dates and days you cannot travel. Find a shared period with Malaysian national holidays in mind.' },
  { stage: 'budget', label: 'Budget', title: 'What’s comfortable for you?', description: 'Set a comfortable amount and an absolute maximum. Your exact numbers stay private.' },
  { stage: 'picks', label: 'Wishlist', title: 'Where’s your heart set?', description: 'Play up to three favourite countries. Every traveller gets the same number of slots.' },
  { stage: 'voting', label: 'Vote', title: 'Swipe for your next stop.', description: 'One shared deck. One vote per country, per person. See where your group lands.' },
  { stage: 'explore', label: 'Explore', title: 'Pin the good stuff.', description: 'Choose the places you’d love to visit. Everyone’s votes become your shared stops.' },
] as const;

const logisticsStep = { stage: 'logistics', label: 'Logistics', title: 'Get there. Settle in.', description: 'How everyone gets there and where everyone stays. Confirm the details or continue with a draft.' } as const;

type Props = { tripId: string; onBack: () => void; onItinerary?: () => void; loadAction?: typeof loadQuest; updateAction?: typeof updateQuest; subscribeAction?: typeof subscribeToQuest; suggestAction?: typeof suggestTripPeriods };

function ExploreStage({ room, busy, act, onConfirmed }: { room: QuestRoom; busy: boolean; act: (action: QuestAction) => Promise<boolean>; onConfirmed: (room: QuestRoom) => void }) {
  const country = countryByCode(room.selectedCountryCode);
  const solo = room.travelParty === 'solo';
  const ownVotes = room.attractionVotes?.find((vote) => vote.memberId === room.currentMemberId)?.attractionIds ?? [];
  const [selected, setSelected] = useState(solo ? room.attractionIds : ownVotes);
  const dirty = [...selected].sort().join(',') !== [...ownVotes].sort().join(',');
  const ballots = room.attractionVotes ?? [];
  const allVoted = room.members.every((member) => ballots.some((ballot) => ballot.memberId === member.memberId && ballot.attractionIds.length > 0));
  if (!country) return <Text accessibilityRole="alert" style={s.error}>The selected country could not be loaded. Refresh the quest to try again.</Text>;
  const organizer = room.currentRole === 'organizer';
  const votes = room.results.find((result) => result.countryCode === country.code)?.agreeCount;
  const mapCountry = { ...country, attractions: [...country.attractions, ...(room.importedPlaces ?? []).map((place) => ({ ...place, category: room.travelParty === 'solo' ? 'Your saved places' : 'From your crew', description: place.address }))] };
  return <View style={s.stack}>
    <View style={s.success}><Text style={s.kicker}>DESTINATION UNLOCKED</Text><Text style={s.title}>{country.flag} {country.name}</Text><Text style={s.body}>{room.travelParty !== 'solo' && votes !== undefined ? `${votes} of ${room.members.length} travellers voted yes. ` : ''}{country.tagline}</Text></View>
    <PlaceImportPanel tripId={room.tripId} countryName={country.name} disabled={busy} onConfirmed={onConfirmed} />
    <Text style={s.heading}>{room.travelParty === 'solo' ? 'Your discovery map' : 'Your crew’s discovery map'}</Text>
    <AttractionMap country={mapCountry} selectedIds={selected} onToggle={(id) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length < 20 ? [...current, id] : current)} disabled={busy} />
    <AppButton label={solo ? 'Save stops & continue to Logistics' : ownVotes.length ? 'Update my attraction votes' : 'Submit my attraction votes'} testID="save-quest-attractions" disabled={!selected.length || (!solo && !dirty)} loading={busy} onPress={() => void act({ type: solo ? 'attractions' : 'attraction_votes', attractionIds: selected })} />
    {!solo ? <View style={s.stack}>
      <Text accessibilityLiveRegion="polite" style={s.body}>{ballots.length} of {room.members.length} travellers have voted. Select up to 20 places each.</Text>
      <CrewChoices room={room} places={mapCountry.attractions} />
      {organizer ? <AppButton label="Compile voted attractions & continue" testID="compile-quest-attractions" disabled={!allVoted || dirty} loading={busy} onPress={() => void act({ type: 'compile_attractions' })} /> : <Text style={s.small}>Once everyone has voted, your organiser compiles all chosen attractions and opens Logistics.</Text>}
    </View> : null}
  </View>;
}

function QuestSummary({ room, onItinerary }: { room: QuestRoom; onItinerary?: () => void }) {
  const country = countryByCode(room.selectedCountryCode);
  return <View style={s.stack}>
    <View style={styles.ticket}>
      <Text style={styles.ticketKicker}>CUTISAMA2 · YOUR TRIP PLAN</Text>
      <Text style={styles.ticketTitle}>{country?.flag} {country?.name}</Text>
      <Text style={styles.ticketBody}>{room.period ? periodLabel(room.period) : ''}</Text>
      <View style={styles.ticketDivider} />
      <Text style={styles.ticketKicker}>THE STOPS YOU PICKED</Text>
      {[...(country?.attractions ?? []), ...(room.importedPlaces ?? [])].filter((place) => room.attractionIds.includes(place.id)).map((place, index) => <Text key={place.id} style={styles.ticketBody}>{String(index + 1).padStart(2, '0')}  {place.name}</Text>)}
      <View style={styles.ticketDivider} />
      <Text style={styles.ticketKicker}>TRIP SPENDING LIMIT</Text>
      <Text style={styles.ticketTitle}>{room.budgetSummary ? money(room.budgetSummary.crewHardCeiling) : '—'}</Text>
      <Text style={styles.ticketBody}>{room.travelParty === 'solo' ? 'Your whole trip' : `per person · ${room.members.length} travellers · whole trip`}</Text>
    </View>
    <Text style={s.body}>Your dates, destination, places and budget are saved.</Text>
    <Text style={s.body}>Turn your selected places into a day-by-day itinerary, with time for travel and meals, within your trip budget.</Text>
    {onItinerary ? <AppButton label={room.travelParty === 'solo' ? 'Generate my itinerary' : room.currentRole === 'organizer' ? 'Generate our itinerary' : 'View our itinerary'} testID="open-quest-itinerary" onPress={onItinerary} /> : null}
  </View>;
}

export function QuestScreen({ tripId, onBack, onItinerary, loadAction = loadQuest, updateAction = updateQuest, subscribeAction = subscribeToQuest, suggestAction = suggestTripPeriods }: Props) {
  const [room, setRoom] = useState<QuestRoom | null>(null);
  const [announcedCountry, setAnnouncedCountry] = useState<string | null>(null);
  const acceptedRoom = useRef<QuestRoom | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const mutation = useRef(false);
  const screenScroll = useRef<ScrollView>(null);
  const refreshFailed = useRef(false);
  const alive = useRef(true);
  const accept = useCallback((next: QuestRoom) => {
    if (!alive.current || (acceptedRoom.current && acceptedRoom.current.revision > next.revision)) return;
    const previous = acceptedRoom.current;
    acceptedRoom.current = next;
    setRoom(next);
    if (previous?.stage === 'voting' && next.stage === 'explore' && next.travelParty !== 'solo') setAnnouncedCountry(next.selectedCountryCode);
    else if (next.stage !== 'explore') setAnnouncedCountry(null);
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

  if (!room) return <Screen scrollRef={screenScroll}><View style={s.stack}><Text style={s.title}>{error ? 'Your quest is waiting.' : 'Gathering your next adventure…'}</Text>{error ? <><Text accessibilityRole="alert" style={s.error}>{error}</Text><AppButton label="Try again" onPress={() => void refresh()} /></> : <Text style={s.body}>Opening your trip plan.</Text>}<AppButton label="Back to the lobby" variant="secondary" onPress={onBack} /></View></Screen>;
  const logisticsOpen = room.stage === 'logistics' || room.stage === 'complete';
  const logisticsDraft = logisticsTotals(room.logistics ?? emptyLogistics, room.members.map((member) => member.memberId), room.budgetSummary?.crewHardCeiling ?? 0).draft;
  const completed = room.stage === 'complete' && !logisticsDraft;
  const voting = room.stage === 'voting';
  const solo = room.travelParty === 'solo';
  const steps = solo ? questSteps.filter(step => step.stage !== 'voting') : questSteps;
  const index = logisticsOpen ? steps.length : steps.findIndex((step) => step.stage === room.stage);
  const step = logisticsOpen ? logisticsStep : steps[Math.max(0, Math.min(index, steps.length - 1))];
  const field = room.stage === 'timing' ? 'availabilitySubmitted' : room.stage === 'picks' ? 'picksSubmitted' : room.stage === 'voting' ? 'votesSubmitted' : room.stage === 'budget' ? 'budgetSubmitted' : null;
  const ready = field ? room.members.filter((member) => member[field]).length : room.members.length;
  return <Screen testID="trip-quest-screen" scrollRef={screenScroll}>
    <DestinationAnnouncement countryCode={announcedCountry} onDismiss={() => setAnnouncedCountry(null)} />
    <View style={s.stack}>
      <View style={s.between}><Pressable accessibilityRole="button" onPress={onBack}><Text style={s.link}>‹ Trip lobby</Text></Pressable><BrandLogo compact /></View>
      {!voting ? <Text numberOfLines={1} style={s.small}>{room.tripName}</Text> : null}
      <FlightPath stage={index} solo={solo} />
      <View style={s.stack}>{!voting ? <Text style={s.kicker}>{completed ? 'QUEST COMPLETE' : logisticsOpen ? 'PLAN YOUR LOGISTICS' : `CHAPTER ${index + 1} · ${step.label.toUpperCase()}`}</Text> : null}<Text accessibilityRole="header" style={[s.title, voting && styles.compactTitle]}>{completed ? (solo ? 'Your adventure is ready.' : 'From group chat to game plan.') : solo && room.stage === 'timing' ? 'Choose your travel dates.' : step.title}</Text>{!voting && !logisticsOpen ? <Text style={s.body}>{completed ? (solo ? 'Your decisions, your adventure.' : 'You made the big decisions. Together.') : solo ? 'Choose what works for your solo adventure.' : step.description}</Text> : null}</View>
      {error ? <View style={s.errorPanel}><Text accessibilityRole="alert" style={s.error}>{error}</Text>{unavailable ? <AppButton label="Reconnect & refresh" variant="secondary" onPress={() => { setError(null); void refresh(); }} /> : <Pressable accessibilityRole="button" onPress={() => setError(null)}><Text style={s.link}>Dismiss</Text></Pressable>}</View> : null}
      {!solo && !completed && !logisticsOpen ? <View><View style={s.between}><Text style={s.kicker}>YOUR TRAVEL CREW</Text><Text accessibilityLiveRegion="polite" style={s.small}>{field ? `${ready} / ${room.members.length} ready` : 'Explore together'}</Text></View>{!voting ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.crew}>
        {room.members.map((member) => { const done = field ? member[field] : true; return <View key={member.memberId} style={styles.traveller}><View style={[styles.avatar, done && styles.avatarReady]}><Text style={styles.avatarText}>{member.displayName.slice(0, 1).toUpperCase()}</Text>{done ? <Text style={styles.check}>✓</Text> : null}</View><Text style={styles.memberName} numberOfLines={1}>{member.memberId === room.currentMemberId ? 'You' : member.displayName}</Text></View>; })}
      </ScrollView> : null}</View> : null}
      {room.period && room.stage !== 'picks' && !completed && !voting ? <Text style={s.small}>✓ {periodLabel(room.period)}{room.selectedCountryCode ? ` · ${countryByCode(room.selectedCountryCode)?.name}` : ''}</Text> : null}
      {room.stage === 'timing' ? <TimingStage room={room} busy={busy || unavailable} act={act} recommend={recommend} /> : null}
      {room.stage === 'picks' ? <CountryPicks room={room} busy={busy || unavailable} act={act} /> : null}
      {room.stage === 'voting' && !solo ? <CountryVote room={room} busy={busy || unavailable} act={act} /> : null}
      {room.stage === 'explore' ? <ExploreStage key={`${room.tripId}:${room.currentMemberId}:${JSON.stringify(room.attractionVotes?.find(vote => vote.memberId === room.currentMemberId)?.attractionIds)}`} room={room} busy={busy || unavailable} act={act} onConfirmed={accept} /> : null}
      {room.stage === 'budget' ? <BudgetStage key={`${room.tripId}:${room.currentMemberId}:${JSON.stringify(room.ownBudget)}`} room={room} busy={busy || unavailable} act={act} /> : null}
      {logisticsOpen ? <View><LogisticsStage room={room} busy={busy || unavailable} act={act} onItinerary={onItinerary} onSectionChange={() => requestAnimationFrame(() => screenScroll.current?.scrollTo({ y: 0, animated: false }))} /></View> : null}
      {completed ? <QuestSummary room={room} onItinerary={onItinerary} /> : null}
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  compactTitle: { fontSize: 25, lineHeight: 30 },
  crew: { gap: spacing.lg, paddingVertical: spacing.md }, traveller: { alignItems: 'center', width: 54, gap: spacing.sm }, avatar: { height: 40, width: 40, backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, avatarReady: { borderColor: colors.sky }, avatarText: { color: colors.ink, fontWeight: '800' }, check: { color: colors.paper, backgroundColor: colors.sky, borderRadius: 9, fontSize: 9, width: 15, height: 15, textAlign: 'center', position: 'absolute', right: -4, bottom: -2 }, memberName: { color: colors.textMuted, fontSize: 10, maxWidth: 54 },
  ticket: { borderWidth: 1, borderColor: colors.sun, backgroundColor: colors.surfaceWarm, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md }, ticketKicker: { color: colors.ink, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 }, ticketTitle: { color: colors.ink, fontSize: 32, fontWeight: '900', letterSpacing: -0.7 }, ticketBody: { color: colors.ink, fontSize: 14, lineHeight: 22 }, ticketDivider: { borderTopColor: colors.disabled, borderTopWidth: 1, borderStyle: 'dashed', marginVertical: spacing.sm },
});
