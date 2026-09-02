import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { abandonLostIdentity } from '@/lib/auth';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export function IdentityRecoveryScreen({ onRejoin, onHome }: { onRejoin: () => void; onHome: () => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function rejoin() { setBusy(true); setError(null); try { await abandonLostIdentity(); onRejoin(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not reset this guest session.'); } finally { setBusy(false); } }
  return <Screen testID="identity-recovery-screen"><Text style={styles.kicker}>IDENTITY RECOVERY</Text><Text style={styles.title}>This device no longer has the room identity.</Text><Text style={styles.body}>Anonymous membership belongs to the securely stored guest session. If that session is lost or removed, it cannot be guessed or silently replaced.</Text><View style={styles.notice}><Text style={styles.noticeTitle}>Rejoin safely</Text><Text style={styles.body}>Ask the organiser for a current invitation. Your previous room actions remain on the server, but the new identity will join as a new member.</Text></View>{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}<View style={styles.actions}><AppButton label="Rejoin with invitation" onPress={() => void rejoin()} loading={busy} testID="rejoin-after-identity-loss" /><AppButton label="Return home" onPress={onHome} variant="secondary" /></View></Screen>;
}
const styles = StyleSheet.create({ kicker: { color: colors.coral, fontSize: typography.label, fontWeight: '900', letterSpacing: 1.4 }, title: { color: colors.white, fontSize: typography.title, fontWeight: '900', lineHeight: 35, marginTop: spacing.md }, body: { color: colors.textMuted, fontSize: typography.body, lineHeight: 24, marginTop: spacing.md }, notice: { backgroundColor: colors.midnightRaised, borderColor: colors.gold, borderRadius: radius.lg, borderWidth: 1, marginTop: spacing.xxl, padding: spacing.xl }, noticeTitle: { color: colors.gold, fontSize: typography.heading, fontWeight: '900' }, actions: { gap: spacing.md, marginTop: spacing.xxl }, error: { color: colors.danger, fontSize: typography.small, marginTop: spacing.lg } });
