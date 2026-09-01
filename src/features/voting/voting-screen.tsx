import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import type { CloseVotePayload, VoteRoom } from '../../../packages/contracts/src/vote';
import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { loadVoteRoom, manageVote, setDestinationLock, submitVote, subscribeToVotes } from '@/features/voting/service';
import { VoteOptionCard } from '@/features/voting/vote-option';
import { colors, radius, spacing, typography } from '@/theme/tokens';

type Props = { tripId: string; onBack: () => void; onItinerary?: () => void; loadAction?: typeof loadVoteRoom; submitAction?: typeof submitVote; manageAction?: typeof manageVote; lockAction?: typeof setDestinationLock; subscribeAction?: typeof subscribeToVotes };

export function VotingScreen({ tripId, onBack, onItinerary, loadAction = loadVoteRoom, submitAction = submitVote, manageAction = manageVote, lockAction = setDestinationLock, subscribeAction = subscribeToVotes }: Props) {
  const [room, setRoom] = useState<VoteRoom | null>(null); const [selected, setSelected] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [connected, setConnected] = useState(false); const [error, setError] = useState<string | null>(null);
  const accept = useCallback((next: VoteRoom) => { setRoom(next); setSelected(next.round?.ownVoteOptionId ?? null); }, []);
  const refresh = useCallback(async () => { try { accept(await loadAction(tripId)); setError(null); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load voting.'); } }, [accept, loadAction, tripId]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  useEffect(() => { if (!room) return; let cleanup: (() => Promise<unknown>) | undefined; let active = true; void subscribeAction(room, { onChanged: () => void refresh(), onConnection: (value) => active && setConnected(value) }).then((value) => { if (active) cleanup = value; else void value(); }); return () => { active = false; if (cleanup) void cleanup(); }; }, [room?.tripId, refresh, subscribeAction]); // eslint-disable-line react-hooks/exhaustive-deps
  async function mutate(action: () => Promise<VoteRoom>) { setBusy(true); setError(null); try { accept(await action()); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Voting could not be updated.'); } finally { setBusy(false); } }
  function manage(action: CloseVotePayload['action']) { void mutate(() => manageAction(tripId, action)); }
  function submit() { if (!room?.round || !selected) { setError('Choose a destination first.'); return; } void mutate(() => submitAction(tripId, room.round!.roundId, selected)); }
  function lock(optionId: string) { void mutate(() => lockAction(tripId, optionId, 'lock')); }
  function confirmUnlock() { Alert.alert('Unlock destination?', 'An existing itinerary may be invalidated and will need to be reviewed.', [{ text: 'Keep locked', style: 'cancel' }, { text: 'Unlock destination', style: 'destructive', onPress: () => void mutate(() => lockAction(tripId, room?.lockedDestination?.optionId ?? 'unlock', 'unlock')) }]); }
  if (!room) return <Screen scroll={false}><View style={styles.center}><Text style={styles.title}>{error ?? 'Opening the ballot…'}</Text></View></Screen>;
  const round = room.round; const organizer = room.currentRole === 'organizer'; const open = round?.status === 'open';
  const winner = round?.options.find((option) => option.optionId === round.winningOptionId);
  return <Screen footer={<View style={styles.footer}>
    {!round && organizer && !room.lockedDestination ? <AppButton label="Start destination vote" loading={busy} onPress={() => manage('start')} testID="start-vote" /> : null}
    {open ? <AppButton label={round.ownVoteOptionId ? 'Change my vote' : 'Submit my vote'} loading={busy} onPress={submit} testID="submit-vote" /> : null}
    {open && organizer ? <AppButton label="Close voting now" loading={busy} onPress={() => manage('close')} testID="close-vote" variant="secondary" /> : null}
    {round?.status === 'tied' && organizer ? <><AppButton label="Run a second vote" loading={busy} onPress={() => manage('second_vote')} testID="second-vote" /><AppButton label="Compare constraints" loading={busy} onPress={() => manage('constraint_comparison')} testID="compare-constraints" variant="secondary" /></> : null}
    {winner && organizer && !room.lockedDestination ? <AppButton label={`Lock ${winner.name}`} loading={busy} onPress={() => lock(winner.optionId)} testID="lock-winner" /> : null}
    {room.lockedDestination && onItinerary ? <AppButton label="Continue to itinerary planning" onPress={onItinerary} testID="continue-itinerary" /> : null}
  </View>} testID="voting-screen">
    <Pressable accessibilityRole="button" onPress={onBack}><Text style={styles.back}>‹ Destinations</Text></Pressable>
    <View style={styles.header}><View><Text style={styles.kicker}>GROUP DECISION</Text><Text style={styles.title}>{room.tripName}</Text></View><Text style={styles.live}>{connected ? '● LIVE' : '○ CONNECTING'}</Text></View>
    <Text style={styles.intro}>One vote each. Choices stay hidden until everyone votes or the organiser closes the round.</Text>
    {room.lockedDestination ? <View style={styles.locked}><Text style={styles.kicker}>DESTINATION LOCKED</Text><Text style={styles.lockedName}>{room.lockedDestination.name}</Text><Text style={styles.body}>The group has moved to itinerary planning.</Text>{organizer ? <Pressable accessibilityRole="button" onPress={confirmUnlock} testID="unlock-destination"><Text style={styles.unlock}>Unlock destination</Text></Pressable> : null}</View> : null}
    {round ? <>
      <View style={styles.progress}><Text style={styles.progressLabel}>ROUND {round.roundNumber}</Text><Text accessibilityLiveRegion="polite" style={styles.progressCount}>{round.votedCount} / {round.participantCount} VOTED</Text></View>
      {open ? <Text style={styles.hidden}>Totals hidden · only participation is visible</Text> : null}
      {round.status === 'tied' ? <View style={styles.tie} testID="tie-path"><Text style={styles.sectionTitle}>The vote is tied</Text><Text style={styles.body}>No destination was chosen. Run a second vote or compare the recorded constraints.</Text></View> : null}
      {round.status === 'closed' && winner ? <View style={styles.result}><Text style={styles.sectionTitle}>{winner.name} leads the group</Text><Text style={styles.body}>{round.resolution === 'constraint_comparison' ? 'Resolved by the recorded constraint comparison.' : 'Resolved by the final vote totals.'}</Text></View> : null}
      <View accessibilityRole="radiogroup" style={styles.options}>{round.options.map((option) => {
        const total = round.totals?.find((item) => item.optionId === option.optionId)?.total;
        return <View key={option.optionId}><VoteOptionCard disabled={!open || busy} onPress={() => { setSelected(option.optionId); setError(null); }} option={option} selected={selected === option.optionId} total={total} />
          {round.status === 'tied' && organizer && round.tiedOptionIds.includes(option.optionId) ? <Pressable accessibilityRole="button" onPress={() => lock(option.optionId)} testID={`lock-tied-${option.optionId}`}><Text style={styles.tieChoice}>Explicitly lock this tied finalist</Text></Pressable> : null}
        </View>;
      })}</View>
      {round.constraintComparison ? <View style={styles.comparison}><Text style={styles.sectionTitle}>Constraint comparison</Text>{round.constraintComparison.map((item) => <Text key={item.optionId} style={styles.body}>{round.options.find((option) => option.optionId === item.optionId)?.name}: {item.score}</Text>)}</View> : null}
    </> : !room.lockedDestination ? <Text style={styles.waiting}>{organizer ? 'Start when the destination options are ready.' : 'Waiting for the organiser to start voting.'}</Text> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' }, back: { color: colors.sky, fontSize: typography.body, marginBottom: spacing.xl }, header: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' }, kicker: { color: colors.coral, fontSize: typography.label, fontWeight: '900', letterSpacing: 1.5 }, title: { color: colors.white, fontSize: typography.title, fontWeight: '900', marginTop: spacing.sm }, live: { color: colors.sky, fontSize: 10, fontWeight: '900' }, intro: { color: colors.textMuted, fontSize: typography.body, lineHeight: 24, marginTop: spacing.md }, progress: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xxl }, progressLabel: { color: colors.coral, fontSize: typography.label, fontWeight: '900' }, progressCount: { color: colors.gold, fontSize: typography.label, fontWeight: '900' }, hidden: { color: colors.textMuted, fontSize: typography.small, marginTop: spacing.sm }, options: { gap: spacing.md, marginTop: spacing.xl }, tie: { backgroundColor: colors.midnightRaised, borderColor: colors.gold, borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm, marginTop: spacing.xl, padding: spacing.lg }, result: { backgroundColor: colors.midnightRaised, borderColor: colors.sky, borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm, marginTop: spacing.xl, padding: spacing.lg }, sectionTitle: { color: colors.white, fontSize: typography.heading, fontWeight: '900' }, body: { color: colors.textMuted, fontSize: typography.small, lineHeight: 20 }, tieChoice: { color: colors.sky, fontSize: typography.small, fontWeight: '800', padding: spacing.md, textAlign: 'center' }, comparison: { gap: spacing.sm, marginTop: spacing.xl }, locked: { backgroundColor: colors.midnightRaised, borderColor: colors.coral, borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm, marginTop: spacing.xl, padding: spacing.xl }, lockedName: { color: colors.white, fontSize: typography.title, fontWeight: '900' }, unlock: { color: colors.danger, fontSize: typography.small, fontWeight: '800', marginTop: spacing.md }, waiting: { color: colors.textMuted, fontSize: typography.body, marginTop: spacing.xxl, textAlign: 'center' }, error: { color: colors.danger, fontSize: typography.small, marginTop: spacing.lg }, footer: { gap: spacing.md },
});
