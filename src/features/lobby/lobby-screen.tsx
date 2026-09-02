import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LobbySchema, memberLabel, type Lobby, type LobbyMember } from '../../../packages/contracts/src/lobby';
import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { StaleStateBanner } from '@/components/StaleStateBanner';
import { closeInvitation } from '@/features/invites/service';
import { loadLobby, removeLobbyMember, setLobbyReady, startTripPlanning, subscribeToLobby } from '@/features/lobby/service';
import { planningModeOptions } from '@/features/trips/planning-modes';
import { recoveryKind } from '@/features/recovery/errors';
import { useOfflineRoom } from '@/features/recovery/use-offline-room';
import { colors, radius, spacing, typography } from '@/theme/tokens';

type Props = {
  tripId: string;
  onInvite: () => void;
  onAccessRevoked: () => void;
  onIdentityLost?: () => void;
  onConstraints?: () => void;
  loadAction?: typeof loadLobby;
  readyAction?: typeof setLobbyReady;
  removeAction?: typeof removeLobbyMember;
  startAction?: typeof startTripPlanning;
  closeAction?: typeof closeInvitation;
  subscribeAction?: typeof subscribeToLobby;
};

function initials(member: LobbyMember) {
  return member.displayName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
}

export function LobbyScreen({ tripId, onInvite, onAccessRevoked, onIdentityLost, onConstraints, loadAction = loadLobby, readyAction = setLobbyReady, removeAction = removeLobbyMember, startAction = startTripPlanning, closeAction = closeInvitation, subscribeAction = subscribeToLobby }: Props) {
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [onlineMembers, setOnlineMembers] = useState<Set<string>>(new Set());
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acceptLobby = useCallback((next: Lobby) => setLobby(next), []);
  const { refresh: refreshRecovered, acceptAuthoritative, stale, reconnecting } = useOfflineRoom({ namespace: 'lobby', scope: tripId, load: () => loadAction(tripId), parse: (value) => LobbySchema.parse(value), accept: acceptLobby });
  const refresh = useCallback(async () => {
    try { await refreshRecovered(); setError(null); }
    catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not load the lobby.';
      setError(message);
      if (recoveryKind(cause) === 'identity_lost') onIdentityLost?.();
      else if (/access is unavailable/i.test(message)) onAccessRevoked();
    }
  }, [onAccessRevoked, onIdentityLost, refreshRecovered]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const subscribedTripId = lobby?.tripId;
  const subscribedMemberId = lobby?.currentMemberId;
  useEffect(() => {
    if (!subscribedTripId || !subscribedMemberId) return undefined;
    let cleanup: (() => Promise<unknown>) | undefined;
    let active = true;
    void subscribeAction({ tripId: subscribedTripId, currentMemberId: subscribedMemberId }, {
      onChanged: () => void refresh(),
      onOnlineMembers: (members) => active && setOnlineMembers(members),
      onConnection: (value) => active && setConnected(value),
      onAccessRevoked,
    }).then((value) => { if (active) cleanup = value; else void value(); });
    return () => { active = false; if (cleanup) void cleanup(); };
  }, [subscribedMemberId, subscribedTripId, onAccessRevoked, refresh, subscribeAction]);

  const currentMember = useMemo(() => lobby?.members.find((member) => member.memberId === lobby.currentMemberId), [lobby]);
  const allReady = Boolean(lobby?.members.every((member) => member.ready));
  const isOrganizer = lobby?.currentRole === 'organizer';

  async function mutate(action: () => Promise<Lobby>) {
    setBusy(true); setError(null);
    try { acceptAuthoritative(await action()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The lobby could not be updated.'); }
    finally { setBusy(false); }
  }

  function confirmRemove(member: LobbyMember) {
    Alert.alert(`Remove ${memberLabel(member)}?`, 'They will immediately lose access and must be invited again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void mutate(() => removeAction(tripId, member.memberId)) },
    ]);
  }

  function confirmClose() {
    Alert.alert('Close joining?', 'The active invitation will stop working. Existing members stay in the room.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Close joining', style: 'destructive', onPress: async () => {
        setBusy(true);
        try { await closeAction(tripId); await refresh(); }
        catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not close joining.'); }
        finally { setBusy(false); }
      } },
    ]);
  }

  if (!lobby) return <Screen scroll={false}><View style={styles.center}><Text style={styles.title}>{error ? 'We could not open this lobby' : 'Gathering the group…'}</Text>{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}</View></Screen>;

  const mode = planningModeOptions.find((option) => option.value === lobby.mode);
  const started = lobby.startedAt !== null;
  const notReadyCount = lobby.members.filter((member) => !member.ready).length;
  const constraintCount = lobby.members.filter((member) => member.constraintComplete).length;
  return <Screen footer={<View style={styles.footerActions}>
    {!started ? <AppButton label={currentMember?.ready ? 'I need more time' : 'I’m ready'} loading={busy} onPress={() => void mutate(() => readyAction(tripId, !currentMember?.ready))} variant={currentMember?.ready ? 'secondary' : 'primary'} /> : null}
    {isOrganizer && !started ? <AppButton disabled={!allReady} label="Start planning" loading={busy} onPress={() => void mutate(() => startAction(tripId))} testID="start-planning" /> : null}
    {started && onConstraints ? <AppButton label="Add my constraints" onPress={onConstraints} testID="open-constraints" /> : null}
  </View>} testID="trip-lobby-screen">
    <View style={styles.headerRow}><View><Text style={styles.kicker}>TRIP LOBBY</Text><Text style={styles.tripName}>{lobby.tripName}</Text></View><View style={styles.connection}><View style={[styles.connectionDot, connected ? styles.online : null]} /><Text style={styles.connectionText}>{connected ? 'Live' : 'Connecting'}</Text></View></View>
    <Text style={styles.mode}>{mode?.title}</Text>
    {stale || reconnecting ? <StaleStateBanner reconnecting={reconnecting} /> : null}
    {started ? <View style={styles.startedBanner}><Text style={styles.startedTitle}>{lobby.constraintsLockedAt ? 'Constraints locked' : 'Planning has begun'}</Text><Text style={styles.body}>{lobby.constraintsLockedAt ? 'The group’s hard boundaries are ready for the next planning stage.' : `Hard constraints are next · ${constraintCount} of ${lobby.members.length} complete.`}</Text></View> : null}
    <ScrollView contentContainerStyle={styles.playerRow} horizontal showsHorizontalScrollIndicator={false}>
      {lobby.members.map((member) => <View key={member.memberId} style={styles.player}><View style={[styles.avatar, member.ready ? styles.avatarReady : null]}><Text style={styles.avatarText}>{initials(member)}</Text><View style={[styles.presenceDot, (onlineMembers.has(member.memberId) || member.memberId === lobby.currentMemberId) ? styles.online : null]} /></View><Text numberOfLines={1} style={styles.playerName}>{memberLabel(member)}</Text><Text style={[styles.readyLabel, member.ready ? styles.ready : null]}>{member.ready ? 'READY' : 'GETTING READY'}</Text></View>)}
    </ScrollView>
    <View style={styles.table}><Text style={styles.tableKicker}>{lobby.members.length - notReadyCount} OF {lobby.members.length} READY</Text><Text style={styles.tableTitle}>{allReady ? 'The table is ready.' : 'Waiting for everyone.'}</Text><Text style={styles.body}>{allReady ? 'The organiser can start the planning flow.' : 'Start stays locked until every active member confirms they are ready.'}</Text></View>
    <View style={styles.rosterHeader}><Text style={styles.sectionTitle}>Travellers</Text><Text style={styles.count}>{lobby.members.length} / 8</Text></View>
    <View style={styles.roster}>{lobby.members.map((member) => <View key={member.memberId} style={styles.memberRow}><View style={styles.memberInfo}><Text style={styles.memberName}>{memberLabel(member)}{member.memberId === lobby.currentMemberId ? ' (you)' : ''}</Text><Text style={styles.memberMeta}>{member.role === 'organizer' ? 'Organiser' : member.ready ? 'Ready to begin' : 'Not ready yet'}</Text></View>{isOrganizer && member.role !== 'organizer' && !started ? <Pressable accessibilityRole="button" onPress={() => confirmRemove(member)}><Text style={styles.remove}>Remove</Text></Pressable> : null}</View>)}</View>
    {isOrganizer ? <View style={styles.organizerActions}><AppButton label="Invite the group" onPress={onInvite} variant="secondary" />{lobby.joiningOpen ? <AppButton label="Close joining" loading={busy} onPress={confirmClose} variant="secondary" /> : <Text style={styles.closed}>Joining is closed</Text>}</View> : null}
    {!allReady && isOrganizer && !started ? <Text accessibilityLiveRegion="polite" style={styles.startReason}>Start planning is disabled because {notReadyCount} active member{notReadyCount === 1 ? '' : 's'} still need to confirm.</Text> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, gap: spacing.md, justifyContent: 'center' }, headerRow: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' }, kicker: { color: colors.sky, fontSize: typography.label, fontWeight: '800', letterSpacing: 1.7 }, tripName: { color: colors.white, fontSize: typography.title, fontWeight: '900', marginTop: spacing.sm }, title: { color: colors.white, fontSize: typography.heading, fontWeight: '800', textAlign: 'center' }, mode: { color: colors.textMuted, fontSize: typography.body, marginTop: spacing.sm }, connection: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs }, connectionDot: { backgroundColor: colors.disabled, borderRadius: radius.pill, height: 8, width: 8 }, connectionText: { color: colors.textMuted, fontSize: typography.small }, online: { backgroundColor: colors.sky }, playerRow: { gap: spacing.lg, paddingVertical: spacing.xxl }, player: { alignItems: 'center', width: 88 }, avatar: { alignItems: 'center', backgroundColor: colors.midnightSoft, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 2, height: 62, justifyContent: 'center', position: 'relative', width: 62 }, avatarReady: { borderColor: colors.gold }, avatarText: { color: colors.white, fontSize: typography.heading, fontWeight: '900' }, presenceDot: { backgroundColor: colors.disabled, borderColor: colors.midnight, borderRadius: radius.pill, borderWidth: 2, bottom: 0, height: 13, position: 'absolute', right: 0, width: 13 }, playerName: { color: colors.white, fontSize: typography.small, fontWeight: '700', marginTop: spacing.sm, maxWidth: 88 }, readyLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '800', marginTop: spacing.xs }, ready: { color: colors.gold }, table: { backgroundColor: colors.midnightRaised, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm, padding: spacing.xl }, tableKicker: { color: colors.coral, fontSize: typography.label, fontWeight: '800', letterSpacing: 1.4 }, tableTitle: { color: colors.white, fontSize: typography.heading, fontWeight: '800' }, body: { color: colors.textMuted, fontSize: typography.body, lineHeight: 23 }, rosterHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xxl }, sectionTitle: { color: colors.white, fontSize: typography.heading, fontWeight: '800' }, count: { color: colors.textMuted, fontSize: typography.small }, roster: { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, marginTop: spacing.md }, memberRow: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.md, minHeight: 68, paddingVertical: spacing.md }, memberInfo: { flex: 1 }, memberName: { color: colors.white, fontSize: typography.body, fontWeight: '700' }, memberMeta: { color: colors.textMuted, fontSize: typography.small, marginTop: spacing.xs }, remove: { color: colors.danger, fontSize: typography.small, fontWeight: '800', padding: spacing.md }, organizerActions: { gap: spacing.md, marginTop: spacing.xl }, closed: { color: colors.textMuted, fontSize: typography.small, textAlign: 'center' }, startReason: { color: colors.textMuted, fontSize: typography.small, lineHeight: 19, marginTop: spacing.lg, textAlign: 'center' }, error: { color: colors.danger, fontSize: typography.small, lineHeight: 19, marginTop: spacing.lg, textAlign: 'center' }, footerActions: { gap: spacing.md }, startedBanner: { backgroundColor: colors.midnightRaised, borderColor: colors.gold, borderLeftWidth: 3, borderRadius: radius.md, gap: spacing.xs, marginTop: spacing.xl, padding: spacing.lg }, startedTitle: { color: colors.gold, fontSize: typography.body, fontWeight: '800' },
});
