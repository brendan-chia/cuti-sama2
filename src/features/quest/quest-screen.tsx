import { placeLabel } from '@/lib/presentation';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { countryByCode } from '../../../packages/contracts/src/countries';
import type { QuestAction, QuestRoom } from '../../../packages/contracts/src/quest';

import { BrandLogo } from '@/components/brand-logo';
import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { FlightPath } from '@/components/flight-path';
import { ExploreSuggestions } from './explore-suggestions';
import { PlaceImportPanel } from './place-import-panel';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { AttractionMap } from './attraction-map';
import { ItineraryPlan } from './itinerary-plan';
import { LogisticsStage } from './logistics-stage';
import { BudgetStage } from './budget-stage';
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
  const [selected, setSelected] = useState(solo ? (ownVotes.length ? ownVotes : room.attractionIds) : ownVotes);
  const dirty = [...selected].sort().join(',') !== [...ownVotes].sort().join(',');
  const ballots = (room.attractionVotes ?? []).filter(ballot => room.members.some(member => member.memberId === ballot.memberId));
  const [planSelection, setPlanSelection] = useState<string[] | null>(null);
  const votedIds = [...new Set(ballots.flatMap(ballot => ballot.attractionIds))].sort();
  const planIds = (planSelection ?? votedIds).filter(id => votedIds.includes(id));
  const allVoted = room.members.every((member) => ballots.some((ballot) => ballot.memberId === member.memberId && ballot.attractionIds.length > 0));
  if (!country) return <Text accessibilityRole="alert" style={s.error}>The selected country could not be loaded. Refresh the quest to try again.</Text>;
  const organizer = room.currentRole === 'organizer';
  const votes = room.results.find((result) => result.countryCode === country.code)?.agreeCount;
  const mapCountry = { ...country, attractions: [...country.attractions, ...(room.importedPlaces ?? []).map((place) => ({ ...place, category: room.travelParty === 'solo' ? 'Your saved places' : 'From your crew', description: place.address }))] };
  return <View style={s.stack}>
    <View style={s.success}><Text style={s.kicker}>DESTINATION UNLOCKED</Text><Text style={s.title}>{country.flag} {country.name}</Text><Text style={s.body}>{room.travelParty !== 'solo' && votes !== undefined ? `${votes} of ${room.members.length} travellers voted yes. ` : ''}{country.tagline}</Text></View>
    <PlaceImportPanel tripId={room.tripId} countryName={country.name} disabled={busy} onConfirmed={(next) => { const added = (next.importedPlaces ?? []).filter(place => !(room.importedPlaces ?? []).some(old => old.id === place.id)).map(place => place.id); setSelected(current => [...new Set([...current, ...added])].slice(0, 20)); onConfirmed(next); }} />
    <Text style={s.heading}>{room.travelParty === 'solo' ? 'Your discovery map' : 'Your crew’s discovery map'}</Text>
    <AttractionMap country={mapCountry} selectedIds={selected} onToggle={(id) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length < 20 ? [...current, id] : current)} disabled={busy} />
    <ExploreSuggestions key={room.tripId + country.code} onConfirmed={onConfirmed} room={room} selectedIds={selected} disabled={busy} onAdd={id => setSelected(current => current.includes(id) || current.length >= 20 ? current : [...current, id])} />
    <AppButton label={solo ? 'Continue to Logistics' : ownVotes.length ? 'Update my attraction votes' : 'Submit my attraction votes'} testID="save-quest-attractions" disabled={busy || !selected.length || (solo && !room.period) || (!solo && !dirty)} loading={busy} onPress={() => void act({ type: solo ? 'attractions' : 'attraction_votes', attractionIds: selected })} />
    {!solo ? <View style={s.stack}>
      <Text accessibilityLiveRegion="polite" style={s.body}>{ballots.length} of {room.members.length} travellers have voted. Select up to 20 places each.</Text>
      <CrewChoices room={room} places={mapCountry.attractions} />
      {organizer ? <View style={s.stack}>
        <Text accessibilityRole="header" style={s.heading}>Choose your itinerary stops</Text>
        <Text style={s.small}>Your crew’s picks, in one place. Tap a stop to include or remove it from your itinerary.</Text>
        {mapCountry.attractions.filter(place => votedIds.includes(place.id)).map((place, index) => <Pressable
          key={place.id} accessibilityRole="checkbox" accessibilityLabel={`Include ${placeLabel(place.name)} in itinerary`}
          aria-checked={planIds.includes(place.id)} aria-disabled={busy} accessibilityState={{ checked: planIds.includes(place.id), disabled: busy }} disabled={busy}
          style={({ pressed }) => [styles.stopCard, pressed && !busy && styles.stopCardPressed, busy && styles.stopCardDisabled]}
          onPress={() => setPlanSelection(current => {
            const ids = current ?? votedIds;
            return ids.includes(place.id) ? ids.filter(id => id !== place.id) : [...ids, place.id];
          })}>
            <View style={styles.stopNumber}><Text style={styles.stopNumberText}>{index + 1}</Text></View>
            <View style={styles.stopCopy}>
              <Text style={styles.stopName}>{placeLabel(place.name)}</Text>
              <Text style={styles.stopDescription} numberOfLines={2}>{place.description || place.category}</Text>
            </View>
            <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.stopCheck}>{planIds.includes(place.id) ? '✓' : '○'}</Text>
          </Pressable>)}
        {!allVoted || dirty ? <Text style={s.small}>Everyone must save their votes before you build the trip.</Text> : null}
        {room.plannerVersion !== '1.0' ? <Text accessibilityRole="alert" style={s.error}>Trip building needs a server update. Your votes are still saved.</Text> : null}
        <AppButton label="Continue to Logistics" testID="compile-quest-attractions" disabled={busy || !allVoted || dirty || !planIds.length || !room.period || room.plannerVersion !== '1.0'}
          loading={busy} onPress={() => void act({ type: 'compile_attractions', attractionIds: planIds })} />
      </View> : <Text style={s.small}>Once everyone has voted, your organiser chooses the itinerary stops and builds the trip.</Text>}
    </View> : null}
  </View>;
}

export function QuestScreen({ tripId, onBack, loadAction = loadQuest, updateAction = updateQuest, subscribeAction = subscribeToQuest, suggestAction = suggestTripPeriods }: Props) {
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
    if (previous?.stage === 'explore' && next.stage === 'logistics') {
      requestAnimationFrame(() => screenScroll.current?.scrollTo({ y: 0, animated: false }));
    }
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
  const logisticsOpen = room.stage === 'logistics';
  const completed = room.stage === 'complete';
  const voting = room.stage === 'voting';
  const solo = room.travelParty === 'solo';
  const steps = solo ? questSteps.filter(step => step.stage !== 'voting') : questSteps;
  const index = logisticsOpen ? steps.length : steps.findIndex((step) => step.stage === room.stage);
  const step = logisticsOpen ? logisticsStep : steps[Math.max(0, Math.min(index, steps.length - 1))];
  const field = room.stage === 'timing' ? 'availabilitySubmitted' : room.stage === 'picks' ? 'picksSubmitted' : room.stage === 'voting' ? 'votesSubmitted' : room.stage === 'budget' ? 'budgetSubmitted' : null;
  const ready = field ? room.members.filter((member) => member[field]).length : room.members.length;
  return <Screen testID="trip-quest-screen" scrollRef={screenScroll}>
    <DestinationAnnouncement countryCode={announcedCountry} onDismiss={() => setAnnouncedCountry(null)} />
    <View style={styles.questStack}>
      <View style={s.between}><Pressable accessibilityRole="button" onPress={onBack}><Text style={s.link}>‹ Trip lobby</Text></Pressable><BrandLogo compact /></View>
      {!voting ? <Text style={s.small}>{room.tripName}</Text> : null}
      <FlightPath stage={completed ? steps.length + 1 : index} solo={solo} />
      <View style={styles.chapterHeader}>{!voting ? <Text style={s.kicker}>{completed ? 'ITINERARY STATION' : logisticsOpen ? 'PLAN YOUR LOGISTICS' : `CHAPTER ${index + 1} · ${step.label.toUpperCase()}`}</Text> : null}<Text accessibilityRole="header" style={[s.title, voting && styles.compactTitle]}>{completed ? 'Your itinerary' : solo && room.stage === 'timing' ? 'Choose your travel dates.' : step.title}</Text>{!voting && !logisticsOpen ? <Text style={s.body}>{completed ? (solo ? 'Your decisions, your adventure.' : 'You made the big decisions. Together.') : solo ? 'Choose what works for your solo adventure.' : step.description}</Text> : null}</View>
      {error ? <View style={s.errorPanel}><Text accessibilityRole="alert" style={s.error}>{error}</Text>{unavailable ? <AppButton label="Reconnect & refresh" variant="secondary" onPress={() => { setError(null); void refresh(); }} /> : <Pressable accessibilityRole="button" onPress={() => setError(null)}><Text style={s.link}>Dismiss</Text></Pressable>}</View> : null}
      {!solo && !completed && !logisticsOpen ? <View><View style={s.between}><Text style={s.kicker}>YOUR TRAVEL CREW</Text><Text accessibilityLiveRegion="polite" style={s.small}>{field ? `${ready} / ${room.members.length} ready` : 'Explore together'}</Text></View>{!voting ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.crew}>
        {room.members.map((member) => { const done = field ? member[field] : true; return <View key={member.memberId} style={styles.traveller}><View style={[styles.avatar, done && styles.avatarReady]}><Text style={styles.avatarText}>{member.displayName.slice(0, 1).toUpperCase()}</Text>{done ? <Text style={styles.check}>✓</Text> : null}</View><Text style={styles.memberName}>{member.memberId === room.currentMemberId ? 'You' : member.displayName}</Text></View>; })}
      </ScrollView> : null}</View> : null}
      {room.period && room.stage !== 'picks' && !completed && !voting ? <Text style={s.small}>✓ {periodLabel(room.period)}{room.selectedCountryCode ? ` · ${countryByCode(room.selectedCountryCode)?.name}` : ''}</Text> : null}
      {room.stage === 'timing' ? <TimingStage room={room} busy={busy || unavailable} act={act} recommend={recommend} /> : null}
      {room.stage === 'picks' ? <CountryPicks room={room} busy={busy || unavailable} act={act} /> : null}
      {room.stage === 'voting' && !solo ? <CountryVote room={room} busy={busy || unavailable} act={act} /> : null}
      {room.stage === 'explore' ? <ExploreStage key={`${room.tripId}:${room.currentMemberId}:${JSON.stringify(room.attractionVotes?.find(vote => vote.memberId === room.currentMemberId)?.attractionIds)}`} room={room} busy={busy || unavailable} act={act} onConfirmed={accept} /> : null}
      {room.stage === 'budget' ? <BudgetStage key={`${room.tripId}:${room.currentMemberId}:${JSON.stringify(room.ownBudget)}`} room={room} busy={busy || unavailable} act={act} /> : null}
      {logisticsOpen ? <View><LogisticsStage room={room} busy={busy || unavailable} act={act} onItinerary={() => requestAnimationFrame(() => screenScroll.current?.scrollTo({ y: 0, animated: false }))} onSectionChange={() => requestAnimationFrame(() => screenScroll.current?.scrollTo({ y: 0, animated: false }))} /></View> : null}
      {completed ? <ItineraryPlan room={room} /> : null}
      {completed && room.currentRole === 'organizer' ? <AppButton label="Edit logistics" variant="secondary" disabled={busy || unavailable} onPress={() => void act({ type: 'edit_logistics' })} /> : null}
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  stopCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 76, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  stopCardPressed: { backgroundColor: colors.surfaceTint },
  stopCardDisabled: { opacity: 0.55 },
  stopNumber: { width: 36, height: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  stopNumberText: { color: colors.coral, fontSize: typography.body, fontWeight: '700' },
  stopCopy: { flex: 1, gap: spacing.xs },
  stopName: { color: colors.ink, fontSize: typography.heading, lineHeight: 25, fontWeight: '700' },
  stopDescription: { color: colors.textMuted, fontSize: typography.small, lineHeight: 19 },
  stopCheck: { color: colors.sky, fontSize: typography.heading, fontWeight: '700' },
  compactTitle: { fontSize: 25, lineHeight: 30 },
  questStack: { gap: spacing.lg },
  chapterHeader: { gap: spacing.md },
  crew: { gap: spacing.lg, paddingVertical: spacing.md }, traveller: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, avatar: { height: 28, width: 28, backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, avatarReady: { borderColor: colors.sky }, avatarText: { color: colors.ink, fontWeight: '800' }, check: { color: colors.paper, backgroundColor: colors.sky, borderRadius: 9, fontSize: 9, width: 15, height: 15, textAlign: 'center', position: 'absolute', right: -4, bottom: -2 }, memberName: { color: colors.textMuted, fontSize: 13, maxWidth: 160 },
  ticket: { borderWidth: 1, borderColor: colors.sun, backgroundColor: colors.surfaceWarm, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md }, ticketKicker: { color: colors.ink, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 }, ticketTitle: { color: colors.ink, fontSize: 32, fontWeight: '700', letterSpacing: -0.7 }, ticketBody: { color: colors.ink, fontSize: 14, lineHeight: 22 }, ticketDivider: { borderTopColor: colors.disabled, borderTopWidth: 1, borderStyle: 'dashed', marginVertical: spacing.sm },
});
