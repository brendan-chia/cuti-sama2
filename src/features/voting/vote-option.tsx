import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { VoteOption } from '../../../packages/contracts/src/vote';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export function VoteOptionCard({ option, selected, disabled, total, onPress }: { option: VoteOption; selected: boolean; disabled: boolean; total?: number; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={onPress} testID={`vote-option-${option.optionId}`} style={[styles.card, selected ? styles.selected : null]}>
    <View style={styles.row}><View style={[styles.radio, selected ? styles.radioSelected : null]}>{selected ? <View style={styles.radioDot} /> : null}</View><View style={styles.copy}><Text style={styles.name}>{option.name}</Text>{option.country ? <Text style={styles.country}>{option.country}</Text> : null}</View>{total !== undefined ? <Text style={styles.total}>{total}</Text> : null}</View>
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, padding: spacing.lg }, selected: { borderColor: colors.coral, borderWidth: 2 }, row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md }, radio: { alignItems: 'center', borderColor: colors.textMuted, borderRadius: radius.pill, borderWidth: 2, height: 24, justifyContent: 'center', width: 24 }, radioSelected: { borderColor: colors.coral }, radioDot: { backgroundColor: colors.coral, borderRadius: radius.pill, height: 12, width: 12 }, copy: { flex: 1 }, name: { color: colors.ink, fontSize: typography.body, fontWeight: '800' }, country: { color: colors.textMuted, fontSize: typography.small, marginTop: spacing.xs }, total: { color: colors.gold, fontSize: typography.heading, fontWeight: '900' },
});
