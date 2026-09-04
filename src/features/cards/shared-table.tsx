import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme/tokens';

export function SharedTable({ submittedCount, participantCount, ownSubmitted, active }: { submittedCount: number; participantCount: number; ownSubmitted: boolean; active: boolean }) {
  return <View accessibilityLabel={`Shared table. ${submittedCount} of ${participantCount} cards played.`} style={[styles.table, active ? styles.active : null]} testID="shared-table">
    <View style={styles.stack}>
      {Array.from({ length: Math.min(submittedCount, 5) }, (_, index) => <View key={index} style={[styles.cardBack, { transform: [{ rotate: `${(index - 2) * 3}deg` }, { translateX: (index - 2) * 2 }] }]} />)}
      {submittedCount === 0 ? <Text style={styles.arrow}>↑</Text> : <Text style={styles.stackCount}>{submittedCount}</Text>}
    </View>
    <Text style={styles.title}>{active ? 'Release to play your card' : ownSubmitted ? 'Your card is face-down' : 'Throw your card onto the table'}</Text>
    <Text style={styles.body}>{ownSubmitted ? 'Your choice stays hidden until reveal. You can replace it before then.' : 'Drag upward into this area, or use the button below.'}</Text>
  </View>;
}

const styles = StyleSheet.create({
  table: { alignItems: 'center', backgroundColor: colors.midnightSoft, borderColor: colors.border, borderRadius: radius.lg, borderStyle: 'dashed', borderWidth: 2, minHeight: 164, padding: spacing.lg },
  active: { borderColor: colors.gold, transform: [{ scale: 1.015 }] }, stack: { alignItems: 'center', height: 72, justifyContent: 'center', width: 96 },
  cardBack: { backgroundColor: colors.coral, borderColor: colors.sand, borderRadius: radius.sm, borderWidth: 1, height: 58, position: 'absolute', width: 42 },
  arrow: { color: colors.gold, fontSize: 34, fontWeight: '300' }, stackCount: { color: colors.midnight, fontSize: typography.body, fontWeight: '900', zIndex: 3 },
  title: { color: colors.white, fontSize: typography.body, fontWeight: '900', marginTop: spacing.sm }, body: { color: colors.textMuted, fontSize: typography.small, lineHeight: 18, marginTop: spacing.xs, maxWidth: 310, textAlign: 'center' },
});
