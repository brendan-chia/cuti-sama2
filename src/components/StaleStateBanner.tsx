import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export function StaleStateBanner({ reconnecting = false }: { reconnecting?: boolean }) {
  return <View accessibilityRole="alert" style={styles.banner} testID="stale-state-banner"><Text style={styles.title}>{reconnecting ? 'Reconnecting…' : 'Offline · showing saved state'}</Text><Text style={styles.body}>{reconnecting ? 'Checking the room for changes. Your pending action keeps its request key.' : 'This view may be out of date. Inputs and pending actions remain on this device.'}</Text></View>;
}
const styles = StyleSheet.create({ banner: { backgroundColor: colors.midnightRaised, borderColor: colors.gold, borderRadius: radius.md, borderWidth: 1, gap: spacing.xs, marginVertical: spacing.lg, padding: spacing.md }, title: { color: colors.gold, fontSize: typography.small, fontWeight: '900' }, body: { color: colors.textMuted, fontSize: typography.small, lineHeight: 19 } });
