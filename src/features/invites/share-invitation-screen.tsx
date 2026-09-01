import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Alert, Share, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import type { CachedInvitation, InvitationStatus } from '../../../packages/contracts/src/invite';
import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { closeInvitation, getInvitationStatus, issueInvitation, rotateInvitation } from '@/features/invites/service';
import { colors, radius, spacing, typography } from '@/theme/tokens';

type State = { status: InvitationStatus; invitation: CachedInvitation | null };
type Props = { tripId: string; loadAction?: typeof getInvitationStatus; issueAction?: typeof issueInvitation; rotateAction?: typeof rotateInvitation; closeAction?: typeof closeInvitation };

export function ShareInvitationScreen({ tripId, loadAction = getInvitationStatus, issueAction = issueInvitation, rotateAction = rotateInvitation, closeAction = closeInvitation }: Props) {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadAction(tripId).then((value) => active && setState(value)).catch((cause: unknown) => active && setError(cause instanceof Error ? cause.message : 'Could not load invitation.'));
    return () => { active = false; };
  }, [loadAction, tripId]);

  async function create(action: typeof issueAction | typeof rotateAction) {
    setBusy(true); setError(null);
    try { const invitation = await action(tripId); setState({ status: invitation, invitation }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create invitation.'); }
    finally { setBusy(false); }
  }

  function confirmRotate() {
    Alert.alert('Replace invitation link?', 'The current link will stop working. Existing members stay in the room.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Replace link', style: 'destructive', onPress: () => void create(rotateAction) },
    ]);
  }

  function confirmClose() {
    Alert.alert('Close invitation link?', 'New guests cannot join with this link. Existing members stay in the room.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Close link', style: 'destructive', onPress: async () => {
        setBusy(true); setError(null);
        try { const status = await closeAction(tripId); setState({ status, invitation: null }); }
        catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not close invitation.'); }
        finally { setBusy(false); }
      } },
    ]);
  }

  const invitation = state?.invitation;
  return (
    <Screen testID="share-invitation-screen">
      <Text style={styles.kicker}>INVITE THE GROUP</Text>
      <Text style={styles.title}>One link to the shared table.</Text>
      <Text style={styles.body}>Anyone with the active link can preview the room name and join as a guest.</Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {!state && !error ? <Text style={styles.body}>Loading invitation…</Text> : null}
      {state?.status.status === 'never_issued' ? <View style={styles.panel}><Text style={styles.panelTitle}>No invitation link yet</Text><Text style={styles.body}>Create an expiring link when you are ready to invite the group.</Text><AppButton label="Create invitation link" loading={busy} onPress={() => void create(issueAction)} /></View> : null}
      {state?.status.status === 'closed' ? <View style={styles.panel}><Text style={styles.panelTitle}>Invitations are closed</Text><Text style={styles.body}>Previous links no longer work. Members already inside are unaffected.</Text><AppButton label="Create a new link" loading={busy} onPress={() => void create(issueAction)} /></View> : null}
      {state?.status.status === 'open' && !invitation ? <View style={styles.panel}><Text style={styles.panelTitle}>The active link is not on this device</Text><Text style={styles.body}>For security, the raw link is only kept on the device that created it. Replace it to share from here.</Text><AppButton label="Replace with a new link" loading={busy} onPress={confirmRotate} /></View> : null}
      {invitation ? <View style={styles.panel}>
        <View style={styles.qr}><QRCode backgroundColor={colors.white} color={colors.midnight} size={190} value={invitation.inviteUrl} /></View>
        <Text selectable style={styles.url}>{invitation.inviteUrl}</Text>
        <Text style={styles.expiry}>Expires {new Date(invitation.expiresAt).toLocaleDateString()}</Text>
        <AppButton label="Share invitation" onPress={() => void Share.share({ message: `Join our CutiSama2 Trip Room: ${invitation.inviteUrl}`, url: invitation.inviteUrl })} />
        <AppButton label="Copy link" variant="secondary" onPress={() => void Clipboard.setStringAsync(invitation.inviteUrl)} />
        <AppButton label="Replace link" variant="secondary" loading={busy} onPress={confirmRotate} />
        <AppButton label="Close invitations" variant="secondary" loading={busy} onPress={confirmClose} />
      </View> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { color: colors.sky, fontSize: typography.label, fontWeight: '800', letterSpacing: 1.7 },
  title: { color: colors.white, fontSize: typography.title, fontWeight: '900', lineHeight: 35, marginTop: spacing.md },
  body: { color: colors.textMuted, fontSize: typography.body, lineHeight: 23, marginTop: spacing.sm },
  panel: { backgroundColor: colors.midnightRaised, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, gap: spacing.md, marginTop: spacing.xxl, padding: spacing.xl },
  panelTitle: { color: colors.white, fontSize: typography.heading, fontWeight: '800' },
  qr: { alignSelf: 'center', backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.lg },
  url: { color: colors.sky, fontSize: typography.small, lineHeight: 19, textAlign: 'center' },
  expiry: { color: colors.textMuted, fontSize: typography.small, textAlign: 'center' },
  error: { backgroundColor: colors.midnightRaised, borderRadius: radius.sm, color: colors.danger, marginTop: spacing.xl, padding: spacing.md },
});
