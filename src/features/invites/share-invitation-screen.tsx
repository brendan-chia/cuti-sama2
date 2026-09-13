import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { Alert, Platform, Share, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import type { CachedInvitation, InvitationStatus } from '../../../packages/contracts/src/invite';
import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { getInvitationStatus, issueInvitation, rotateInvitation } from '@/features/invites/service';
import { invitationBrowserUrl, invitationUrlForOrigin } from '@/features/invites/validation';
import { colors, radius, spacing, typography } from '@/theme/tokens';

type State = { status: InvitationStatus; invitation: CachedInvitation | null };
type Props = { tripId: string; loadAction?: typeof getInvitationStatus; issueAction?: typeof issueInvitation; rotateAction?: typeof rotateInvitation };

export function ShareInvitationScreen({ tripId, loadAction = getInvitationStatus, issueAction = issueInvitation, rotateAction = rotateInvitation }: Props) {
  const [state, setState] = useState<State | null>(null);
  const [retry, setRetry] = useState(0);
  const [qrWidth, setQrWidth] = useState(180);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const value = await loadAction(tripId);
      if (!active) return;
      setError(null);
      if (value.status.status === 'never_issued') {
        const invitation = await issueAction(tripId);
        if (active) setState({ status: invitation, invitation });
      } else setState(value);
    })().catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Could not prepare invitation.'); });
    return () => { active = false; };
  }, [loadAction, issueAction, tripId, retry]);

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

  const invitation = state?.invitation;
  const currentOrigin = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : null;
  const shareUrl = invitation ? (__DEV__ && Platform.OS !== 'web'
    ? Linking.createURL('invite/' + encodeURIComponent(invitation.token))
    : invitationUrlForOrigin(invitation, currentOrigin)) : null;
  const browserUrl = invitation && shareUrl ? invitationBrowserUrl(invitation, shareUrl) : null;
  return (
    <Screen testID="share-invitation-screen">
      <Text style={styles.kicker}>INVITE THE GROUP</Text>
      <Text style={styles.title}>One link to the shared table.</Text>
      <Text style={styles.body}>Anyone with the active link can preview the room name and join as a guest.</Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {!state && error ? <AppButton label="Try again" onPress={() => { setError(null); setRetry(value => value + 1); }} /> : null}
      {!state && !error ? <Text style={styles.body}>Preparing your invitation…</Text> : null}
      {state?.status.status === 'closed' ? <View style={styles.panel}><Text style={styles.panelTitle}>Invitations are closed</Text><Text style={styles.body}>Previous links no longer work. Members already inside are unaffected.</Text><AppButton label="Create a new link" loading={busy} onPress={() => void create(issueAction)} /></View> : null}
      {state?.status.status === 'open' && !invitation ? <View style={styles.panel}><Text style={styles.panelTitle}>The active link is not on this device</Text><Text style={styles.body}>For security, the raw link is only kept on the device that created it. Replace it to share from here.</Text><AppButton label="Replace with a new link" loading={busy} onPress={confirmRotate} /></View> : null}
      {invitation && shareUrl ? <View style={styles.panel}>
        <View style={styles.qr} onLayout={({ nativeEvent }) => setQrWidth(Math.max(1, Math.min(220, nativeEvent.layout.width - 32)))}><QRCode quietZone={16} backgroundColor={colors.paper} color={colors.ink} size={qrWidth} value={shareUrl} /></View>
        <Text style={styles.expiry}>Expires {new Date(invitation.expiresAt).toLocaleDateString()}</Text>
        <AppButton label="Share invitation" onPress={() => void Share.share({ message: `Join our CutiSama2 Trip Room: ${shareUrl}`, url: shareUrl })} />
        <AppButton label="Copy link" variant="secondary" onPress={() => void Clipboard.setStringAsync(shareUrl)} />
        {browserUrl ? <><Text style={styles.body}>Joining on a laptop? Open the browser link while the demo server is running. For a local connection, use the same Wi-Fi.</Text><AppButton label="Copy browser link" variant="secondary" onPress={() => void Clipboard.setStringAsync(browserUrl)} /></> : null}
        <Text style={styles.body}>If the link does not open, open CutiSama2, choose Join a trip and paste the invitation link there. Join before the organiser starts planning.</Text>
      </View> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { color: colors.sky, fontSize: typography.label, fontWeight: '800', letterSpacing: 1.7 },
  title: { color: colors.ink, fontSize: typography.title, fontWeight: '900', lineHeight: 35, marginTop: spacing.md },
  body: { color: colors.textMuted, fontSize: typography.body, lineHeight: 23, marginTop: spacing.sm },
  panel: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, gap: spacing.md, marginTop: spacing.xxl, padding: spacing.xl },
  panelTitle: { color: colors.ink, fontSize: typography.heading, fontWeight: '800' },
  qr: { width: '100%', alignItems: 'center', backgroundColor: colors.paper, borderRadius: radius.md },
  expiry: { color: colors.textMuted, fontSize: typography.small, textAlign: 'center' },
  error: { backgroundColor: colors.surface, borderRadius: radius.sm, color: colors.danger, marginTop: spacing.xl, padding: spacing.md },
});
