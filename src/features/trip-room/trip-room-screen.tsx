import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TripRoomSchema, type TripRoom } from '../../../packages/contracts/src/preferences';
import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { StaleStateBanner } from '@/components/StaleStateBanner';
import { nextRoundKind } from '@/domain/round-state';
import { preferenceCardFor } from '@/features/cards/card-definitions';
import { PreferenceCard } from '@/features/cards/preference-card';
import { loadTripRoom, managePreferenceRound, submitPreferenceCard, subscribeToTripRoom } from '@/features/trip-room/service';
import { useOfflineRoom } from '@/features/recovery/use-offline-room';
import { recoveryKind, recoveryMessage } from '@/features/recovery/errors';
import { useReducedMotion } from '@/theme/motion';
import { colors, radius, spacing, typography } from '@/theme/tokens';

type Props = { tripId: string; onBack: () => void; onReveal?: () => void; loadAction?: typeof loadTripRoom; submitAction?: typeof submitPreferenceCard; manageAction?: typeof managePreferenceRound; subscribeAction?: typeof subscribeToTripRoom };

export function TripRoomScreen({ tripId, onBack, onReveal, loadAction = loadTripRoom, submitAction = submitPreferenceCard, manageAction = managePreferenceRound, subscribeAction = subscribeToTripRoom }: Props) {
  const [room, setRoom] = useState<TripRoom | null>(null);
  const [value, setValue] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedSubmission = useRef<string | null>(null);
  const reducedMotion = useReducedMotion();
  const acceptRoom = useCallback((next: TripRoom) => {
    setRoom(next);
    const submissionKey = next.currentRound
      ? `${next.currentRound.roundId}:${next.currentRound.ownSubmission?.updatedAt ?? 'none'}`
      : null;
    if (!dirty || submissionKey !== loadedSubmission.current) {
      setValue(next.currentRound?.ownSubmission?.value ?? '');
      setDirty(false);
      loadedSubmission.current = submissionKey;
    }
  }, [dirty]);
  const { refresh: refreshRecovered, acceptAuthoritative, stale, reconnecting } = useOfflineRoom({ namespace: 'preference-room', scope: tripId, load: () => loadAction(tripId), parse: (value) => TripRoomSchema.parse(value), accept: acceptRoom });
  const refresh = useCallback(async () => { try { await refreshRecovered(); setError(null); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load the Trip Room.'); } }, [refreshRecovered]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  useEffect(() => {
    if (!room) return undefined;
    let cleanup: (() => Promise<unknown>) | undefined;
    let active = true;
    void subscribeAction(room, { onChanged: () => void refresh(), onConnection: (state) => active && setConnected(state) }).then((nextCleanup) => { if (active) cleanup = nextCleanup; else void nextCleanup(); });
    return () => { active = false; if (cleanup) void cleanup(); };
  }, [room?.tripId, refresh, subscribeAction]); // eslint-disable-line react-hooks/exhaustive-deps
  async function mutate(action: () => Promise<TripRoom>) {
    setBusy(true); setError(null);
    try { acceptAuthoritative(await action()); }
    catch (cause) { setError(recoveryMessage(recoveryKind(cause))); }
    finally { setBusy(false); }
  }
  function submit() {
    const round = room?.currentRound;
    if (!round || value.trim().length === 0) { setError('Add a preference before submitting.'); return; }
    void mutate(() => submitAction({ tripId, roundId: round.roundId, value }));
  }
  if (!room) return <Screen scroll={false}><View style={styles.center}><Text style={styles.title}>{error ?? 'Joining the Trip Room…'}</Text></View></Screen>;
  const round = room.currentRound;
  const organizer = room.currentRole === 'organizer';
  const card = round ? preferenceCardFor(round.kind) : null;
  const collecting = round?.status === 'collecting';
  const nextKind = round ? nextRoundKind(round.kind) : null;
  return <Screen footer={<View style={styles.footer}>
    {!round && organizer ? <AppButton label="Start preference rounds" loading={busy} onPress={() => void mutate(() => manageAction(tripId, 'start'))} testID="start-rounds" /> : null}
    {round && collecting ? <AppButton label={round.ownSubmission ? 'Update my card' : 'Submit card'} loading={busy} onPress={submit} testID="submit-card" /> : null}
    {round && collecting && organizer ? <AppButton label="Close & reveal round" loading={busy} onPress={() => void mutate(() => manageAction(tripId, 'close'))} variant="secondary" testID="close-round" /> : null}
    {round?.status === 'revealed' && organizer ? <AppButton label="Close round" loading={busy} onPress={() => void mutate(() => manageAction(tripId, 'close'))} testID="close-round" /> : null}
    {round?.status === 'closed' && nextKind && organizer ? <AppButton label={`Open ${preferenceCardFor(nextKind).label} round`} loading={busy} onPress={() => void mutate(() => manageAction(tripId, 'advance'))} testID="advance-round" /> : null}
    {round?.status === 'closed' && !nextKind && onReveal ? <AppButton label="Reveal the group match" onPress={onReveal} testID="open-group-reveal" /> : null}
  </View>} testID="preference-trip-room">
    <Pressable accessibilityRole="button" onPress={onBack}><Text style={styles.back}>‹ Constraints</Text></Pressable>
    <View style={styles.header}><View style={styles.heading}><Text style={styles.kicker}>PREFERENCE TRIP ROOM</Text><Text style={styles.title}>{room.tripName}</Text></View><View style={styles.connection}><View style={[styles.dot, connected ? styles.live : null]} /><Text style={styles.meta}>{connected ? 'Live' : 'Connecting'}</Text></View></View>
    <Text style={styles.intro}>Cards stay blind while everyone answers. Only readiness is shared until the round reveals.</Text>
    {stale || reconnecting ? <StaleStateBanner reconnecting={reconnecting} /> : null}
    {reducedMotion ? <Text accessibilityLiveRegion="polite" style={styles.motionNote}>Reduced motion · transitions are immediate</Text> : null}
    {!round ? <View style={styles.waiting}><Text style={styles.sectionTitle}>The table is ready</Text><Text style={styles.body}>{organizer ? 'Start the Vibe round when everyone is settled.' : 'Waiting for the organiser to start the first round.'}</Text></View> : null}
    {round ? <>
      <View style={styles.progress}><Text style={styles.progressText}>ROUND {round.sequence} OF 5 · {card?.label.toUpperCase()}</Text><Text accessibilityLiveRegion="polite" style={styles.progressCount}>{round.submittedCount} / {round.participantCount} READY</Text></View>
      <View style={styles.players}>{round.participants.map((participant) => <View key={participant.memberId} style={[styles.player, participant.removed ? styles.removed : null]}><View style={[styles.avatar, participant.submitted ? styles.readyAvatar : null]}><Text style={styles.avatarText}>{participant.displayName[0]?.toUpperCase()}</Text></View><Text numberOfLines={1} style={styles.playerName}>{participant.displayName}{participant.discriminator > 1 ? ` · ${participant.discriminator}` : ''}</Text><Text style={[styles.playerState, participant.submitted ? styles.ready : null]}>{participant.removed ? 'LEFT' : participant.submitted ? 'READY' : 'THINKING'}</Text></View>)}</View>
      {collecting && card ? <PreferenceCard card={card} disabled={busy} error={error ?? undefined} onChange={(text) => { setValue(text); setDirty(true); setError(null); }} selected={value.trim().length > 0} value={value} /> : null}
      {round.status !== 'collecting' ? <View accessibilityLiveRegion="polite" style={styles.reveal}><Text style={styles.sectionTitle}>{round.status === 'closed' ? 'Round closed' : 'Cards revealed'}</Text><Text style={styles.body}>Everyone can now see the submitted cards.</Text><View style={styles.revealedCards}>{round.revealedSubmissions.map((submission) => <View key={submission.memberId} style={styles.revealedCard}><Text style={styles.revealedName}>{submission.displayName}{submission.discriminator > 1 ? ` · ${submission.discriminator}` : ''}</Text><Text style={styles.revealedValue}>{submission.value}</Text></View>)}</View>{round.revealedSubmissions.length === 0 ? <Text style={styles.meta}>No cards were submitted before the round closed.</Text> : null}</View> : null}
      {round.status === 'closed' && !nextKind ? <View style={styles.complete}><Text style={styles.sectionTitle}>All five rounds complete</Text><Text style={styles.body}>The group’s revealed preference cards are ready for planning.</Text></View> : null}
      {round.status !== 'collecting' && !organizer && nextKind ? <Text style={styles.waitText}>Waiting for the organiser to open the next round.</Text> : null}
    </> : null}
    {error && !collecting ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: spacing.xl }, back: { color: colors.sky, fontSize: typography.body, marginBottom: spacing.xl }, header: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' }, heading: { flex: 1 }, kicker: { color: colors.sky, fontSize: typography.label, fontWeight: '800', letterSpacing: 1.6 }, title: { color: colors.white, fontSize: typography.title, fontWeight: '900', marginTop: spacing.sm }, connection: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs }, dot: { backgroundColor: colors.disabled, borderRadius: radius.pill, height: 8, width: 8 }, live: { backgroundColor: colors.sky }, meta: { color: colors.textMuted, fontSize: typography.small, lineHeight: 19 }, intro: { color: colors.textMuted, fontSize: typography.body, lineHeight: 24, marginTop: spacing.md }, motionNote: { color: colors.sky, fontSize: typography.small, marginTop: spacing.sm }, waiting: { backgroundColor: colors.midnightRaised, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm, marginTop: spacing.xxl, padding: spacing.xl }, sectionTitle: { color: colors.white, fontSize: typography.heading, fontWeight: '800' }, body: { color: colors.textMuted, fontSize: typography.body, lineHeight: 23 }, progress: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginVertical: spacing.xl }, progressText: { color: colors.coral, flex: 1, fontSize: typography.label, fontWeight: '800', letterSpacing: 1.2 }, progressCount: { color: colors.textMuted, fontSize: typography.label, fontWeight: '800' }, players: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.xl }, player: { alignItems: 'center', minWidth: 64, width: '21%' }, removed: { opacity: 0.45 }, avatar: { alignItems: 'center', backgroundColor: colors.midnightSoft, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 2, height: 48, justifyContent: 'center', width: 48 }, readyAvatar: { borderColor: colors.gold }, avatarText: { color: colors.white, fontSize: typography.body, fontWeight: '900' }, playerName: { color: colors.white, fontSize: typography.label, fontWeight: '700', marginTop: spacing.sm, maxWidth: '100%' }, playerState: { color: colors.textMuted, fontSize: 9, fontWeight: '800', marginTop: spacing.xs }, ready: { color: colors.gold }, reveal: { gap: spacing.sm, marginTop: spacing.md }, revealedCards: { gap: spacing.md, marginTop: spacing.lg }, revealedCard: { backgroundColor: colors.midnightRaised, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, minHeight: 96, padding: spacing.lg }, revealedName: { color: colors.gold, fontSize: typography.small, fontWeight: '800' }, revealedValue: { color: colors.white, fontSize: typography.body, lineHeight: 24, marginTop: spacing.sm }, complete: { backgroundColor: colors.midnightRaised, borderColor: colors.gold, borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm, marginTop: spacing.xl, padding: spacing.xl }, waitText: { color: colors.textMuted, fontSize: typography.small, marginTop: spacing.xl, textAlign: 'center' }, error: { color: colors.danger, fontSize: typography.small, lineHeight: 19, marginTop: spacing.lg }, footer: { gap: spacing.md },
});
