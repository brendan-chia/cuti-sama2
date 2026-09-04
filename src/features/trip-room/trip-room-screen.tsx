import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, Vibration, View } from 'react-native';

import { TripRoomSchema, type PreferenceChoice, type TripRoom } from '../../../packages/contracts/src/preferences';
import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { StaleStateBanner } from '@/components/StaleStateBanner';
import { nextRoundKind } from '@/domain/round-state';
import { CardHand } from '@/features/cards/card-hand';
import { choicesForRound, preferenceChoiceFor, roundCopy, roundLabel } from '@/features/cards/card-definitions';
import { CustomMustHaveSheet } from '@/features/cards/custom-must-have-sheet';
import { RoundReveal } from '@/features/cards/round-reveal';
import { SharedTable } from '@/features/cards/shared-table';
import { recoveryKind, recoveryMessage } from '@/features/recovery/errors';
import { useOfflineRoom } from '@/features/recovery/use-offline-room';
import { loadTripRoom, managePreferenceRound, submitPreferenceCard, subscribeToTripRoom } from '@/features/trip-room/service';
import { useReducedMotion } from '@/theme/motion';
import { colors, radius, spacing, typography } from '@/theme/tokens';

type Props = { tripId: string; onBack: () => void; onReveal?: () => void; loadAction?: typeof loadTripRoom; submitAction?: typeof submitPreferenceCard; manageAction?: typeof managePreferenceRound; subscribeAction?: typeof subscribeToTripRoom };
function actionError(cause: unknown) { const kind = recoveryKind(cause); return kind === 'unknown' && cause instanceof Error ? cause.message : recoveryMessage(kind); }

export function TripRoomScreen({ tripId, onBack, onReveal, loadAction = loadTripRoom, submitAction = submitPreferenceCard, manageAction = managePreferenceRound, subscribeAction = subscribeToTripRoom }: Props) {
  const [room, setRoom] = useState<TripRoom | null>(null); const [selectedId, setSelectedId] = useState<string | null>(null); const [customText, setCustomText] = useState('');
  const [customOpen, setCustomOpen] = useState(false); const [busy, setBusy] = useState(false); const [connected, setConnected] = useState(false); const [dropActive, setDropActive] = useState(false); const [error, setError] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  const acceptRoom = useCallback((next: TripRoom) => {
    setRoom(next); const own = next.currentRound?.ownSubmission; setSelectedId(own?.choiceId ?? null); setCustomText(own?.customText ?? '');
  }, []);
  const { refresh: refreshRecovered, acceptAuthoritative, stale, reconnecting } = useOfflineRoom({ namespace: 'preference-room', scope: tripId, load: () => loadAction(tripId), parse: (value) => TripRoomSchema.parse(value), accept: acceptRoom });
  const refresh = useCallback(async () => { try { await refreshRecovered(); setError(null); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load the Trip Room.'); } }, [refreshRecovered]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  useEffect(() => { if (!room) return undefined; let cleanup: (() => Promise<unknown>) | undefined; let active = true; void subscribeAction(room, { onChanged: () => void refresh(), onConnection: (state) => active && setConnected(state) }).then((next) => { if (active) cleanup = next; else void next(); }); return () => { active = false; if (cleanup) void cleanup(); }; }, [room?.tripId, refresh, subscribeAction]); // eslint-disable-line react-hooks/exhaustive-deps

  async function manage(action: 'start' | 'close' | 'advance') { setBusy(true); setError(null); try { acceptAuthoritative(await manageAction(tripId, action)); } catch (cause) { setError(actionError(cause)); } finally { setBusy(false); } }
  async function play(card: PreferenceChoice, nextCustomText?: string) {
    const round = room?.currentRound;
    if (!round) return;
    const submittedCustomText = nextCustomText?.trim() ?? (card.id === 'custom' ? customText.trim() : '');
    if (card.id === 'custom' && !submittedCustomText) { setCustomOpen(true); return; }
    setBusy(true); setError(null);
    try {
      const next = await submitAction({ tripId, roundId: round.roundId, roundType: round.kind, choiceId: card.id, customText: card.id === 'custom' ? submittedCustomText : null });
      acceptAuthoritative(next); Vibration.vibrate(12);
    } catch (cause) { setError(actionError(cause)); }
    finally { setBusy(false); }
  }
  if (!room) return <Screen scroll={false}><View style={styles.center}><Text style={styles.title}>{error ?? 'Joining the Trip Room…'}</Text></View></Screen>;
  const round = room.currentRound; const organizer = room.currentRole === 'organizer'; const collecting = round?.status === 'collecting'; const nextKind = round ? nextRoundKind(round.kind) : null;
  const cards = round ? choicesForRound(round.kind) : [];
  return <Screen footer={<View style={styles.footer}>
    {!round && organizer ? <AppButton label="Start preference rounds" loading={busy} onPress={() => void manage('start')} testID="start-rounds" /> : null}
    {collecting && organizer ? <AppButton label="Close & reveal round" loading={busy} onPress={() => void manage('close')} variant="secondary" testID="close-round" /> : null}
    {round?.status === 'revealed' && organizer ? <AppButton label="Close round" loading={busy} onPress={() => void manage('close')} testID="close-round" /> : null}
    {round?.status === 'closed' && nextKind && organizer ? <AppButton label={`Open ${roundLabel(nextKind)} round`} loading={busy} onPress={() => void manage('advance')} testID="advance-round" /> : null}
    {round?.status === 'closed' && !nextKind && onReveal ? <AppButton label="Reveal the group match" onPress={onReveal} testID="open-group-reveal" /> : null}
  </View>} testID="preference-trip-room">
    <Pressable accessibilityLabel="Back to Trip Lobby" accessibilityRole="button" onPress={onBack}><Text style={styles.back}>‹ Trip Lobby</Text></Pressable>
    <View style={styles.header}><View style={styles.heading}><Text style={styles.kicker}>PREFERENCE TABLE</Text><Text style={styles.title}>{room.tripName}</Text></View><View style={styles.connection}><View style={[styles.dot, connected ? styles.live : null]} /><Text style={styles.meta}>{connected ? 'Live' : 'Connecting'}</Text></View></View>
    <Text style={styles.intro}>Choices stay face-down while everyone plays. Only readiness is shared before reveal.</Text>
    {stale || reconnecting ? <StaleStateBanner reconnecting={reconnecting} /> : null}{reducedMotion ? <Text accessibilityLiveRegion="polite" style={styles.motionNote}>Reduced motion · transitions use short fades</Text> : null}
    {!round ? <View style={styles.waiting}><Text style={styles.sectionTitle}>The table is ready</Text><Text style={styles.body}>{organizer ? 'Start the Vibe round when everyone is settled.' : 'Waiting for the organiser to start the first round.'}</Text></View> : null}
    {round ? <>
      <View style={styles.progress}><Text style={styles.progressText}>ROUND {round.sequence} OF 3 · {roundLabel(round.kind).toUpperCase()}</Text><Text accessibilityLiveRegion="polite" style={styles.progressCount}>{round.submittedCount} / {round.participantCount} READY</Text></View>
      <ScrollView contentContainerStyle={styles.players} horizontal showsHorizontalScrollIndicator={false}>{round.participants.map((participant) => <View key={participant.memberId} style={[styles.player, participant.removed ? styles.removed : null]}><View style={[styles.avatar, participant.submitted ? styles.readyAvatar : null]}><Text style={styles.avatarText}>{participant.displayName[0]?.toUpperCase()}</Text></View><Text numberOfLines={1} style={styles.playerName}>{participant.displayName}{participant.discriminator > 1 ? ` · ${participant.discriminator}` : ''}</Text><Text style={[styles.playerState, participant.submitted ? styles.ready : null]}>{participant.removed ? 'LEFT' : participant.submitted ? 'READY' : 'THINKING'}</Text></View>)}</ScrollView>
      {collecting ? <><Text style={styles.roundTitle}>{roundCopy[round.kind].title}</Text><Text style={styles.roundInstruction}>{roundCopy[round.kind].instruction}</Text><SharedTable active={dropActive} ownSubmitted={Boolean(round.ownSubmission)} participantCount={round.participantCount} submittedCount={round.submittedCount} />
        {cards.length ? <CardHand cards={cards} customText={customText} disabled={busy} onDropActive={setDropActive} onPlay={(card) => void play(card)} reducedMotion={reducedMotion} selectedId={selectedId} /> : <Text accessibilityRole="alert" style={styles.error}>Card choices could not be loaded.</Text>}
      </> : <RoundReveal round={round} />}
      {round.status === 'closed' && !nextKind ? <View style={styles.complete}><Text style={styles.sectionTitle}>All three rounds complete</Text><Text style={styles.body}>The group’s revealed cards are ready for planning.</Text></View> : null}
      {round.status !== 'collecting' && !organizer && nextKind ? <Text style={styles.waitText}>Waiting for the organiser to open the next round.</Text> : null}
    </> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {customOpen ? <CustomMustHaveSheet initialValue={customText} onCancel={() => setCustomOpen(false)} onCreate={(text) => { const customCard = round ? preferenceChoiceFor(round.kind, 'custom') : null; setCustomText(text); setCustomOpen(false); setError(null); if (customCard) void play(customCard, text); }} visible /> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: spacing.xl }, back: { color: colors.sky, fontSize: typography.body, marginBottom: spacing.lg, minHeight: 44, paddingTop: spacing.sm }, header: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' }, heading: { flex: 1 }, kicker: { color: colors.sky, fontSize: typography.label, fontWeight: '900', letterSpacing: 1.6 }, title: { color: colors.white, fontSize: typography.title, fontWeight: '900', letterSpacing: -0.6, marginTop: spacing.sm }, connection: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs }, dot: { backgroundColor: colors.disabled, borderRadius: radius.pill, height: 8, width: 8 }, live: { backgroundColor: colors.sky }, meta: { color: colors.textMuted, fontSize: typography.small }, intro: { color: colors.textMuted, fontSize: typography.body, lineHeight: 24, marginTop: spacing.sm, maxWidth: 520 }, motionNote: { color: colors.sky, fontSize: typography.small, marginTop: spacing.sm }, waiting: { backgroundColor: colors.midnightRaised, borderRadius: radius.lg, gap: spacing.sm, marginTop: spacing.xxl, padding: spacing.xl }, sectionTitle: { color: colors.white, fontSize: typography.heading, fontWeight: '900' }, body: { color: colors.textMuted, fontSize: typography.body, lineHeight: 23 }, progress: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xl }, progressText: { color: colors.coral, flex: 1, fontSize: typography.label, fontWeight: '900', letterSpacing: 1.1 }, progressCount: { color: colors.gold, fontSize: typography.label, fontWeight: '900' }, players: { gap: spacing.lg, paddingBottom: spacing.xl, paddingTop: spacing.lg }, player: { alignItems: 'center', width: 70 }, removed: { opacity: 0.45 }, avatar: { alignItems: 'center', backgroundColor: colors.midnightSoft, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 2, height: 48, justifyContent: 'center', width: 48 }, readyAvatar: { borderColor: colors.gold }, avatarText: { color: colors.white, fontSize: typography.body, fontWeight: '900' }, playerName: { color: colors.white, fontSize: typography.label, fontWeight: '700', marginTop: spacing.sm, maxWidth: 70 }, playerState: { color: colors.textMuted, fontSize: 9, fontWeight: '900', marginTop: spacing.xs }, ready: { color: colors.gold }, roundTitle: { color: colors.white, fontSize: typography.heading, fontWeight: '900' }, roundInstruction: { color: colors.textMuted, fontSize: typography.small, lineHeight: 20, marginBottom: spacing.lg, marginTop: spacing.xs }, complete: { backgroundColor: colors.midnightRaised, borderColor: colors.gold, borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm, marginTop: spacing.xl, padding: spacing.xl }, waitText: { color: colors.textMuted, fontSize: typography.small, marginTop: spacing.xl, textAlign: 'center' }, error: { color: colors.danger, fontSize: typography.small, lineHeight: 19, marginTop: spacing.md, textAlign: 'center' }, footer: { gap: spacing.md },
});
