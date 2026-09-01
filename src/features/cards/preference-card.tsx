import { StyleSheet, Text, TextInput, View } from 'react-native';

import type { PreferenceCardDefinition } from '../../../packages/contracts/src/preferences';
import { colors, radius, spacing, typography } from '@/theme/tokens';

type Props = {
  card: PreferenceCardDefinition;
  value: string;
  selected: boolean;
  disabled?: boolean;
  error?: string;
  onChange: (value: string) => void;
};

export function PreferenceCard({ card, value, selected, disabled = false, error, onChange }: Props) {
  return <View style={[styles.card, selected ? styles.selected : null, error ? styles.errorBorder : null]} testID={`preference-card-${card.kind}`}>
    <View accessibilityLabel={card.accessibleName} accessibilityState={{ disabled, selected }} accessible style={styles.topline} testID={`preference-card-accessible-${card.kind}`}><Text style={styles.label}>{card.label}</Text><Text style={styles.state}>{selected ? 'SELECTED' : 'YOUR CARD'}</Text></View>
    <Text style={styles.example}>{card.example}</Text>
    <TextInput accessibilityLabel={`${card.label} answer`} editable={!disabled} maxLength={240} multiline onChangeText={onChange} placeholder="Write a short, specific answer" placeholderTextColor={colors.disabled} selectionColor={colors.coral} style={styles.input} value={value} />
    <Text style={styles.counter}>{value.length} / 240</Text>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.midnightRaised, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 2, minHeight: 220, padding: spacing.xl },
  selected: { borderColor: colors.gold }, errorBorder: { borderColor: colors.danger },
  topline: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: colors.white, flexShrink: 1, fontSize: typography.heading, fontWeight: '900' },
  state: { color: colors.gold, fontSize: typography.label, fontWeight: '800', letterSpacing: 1.2 },
  example: { color: colors.textMuted, fontSize: typography.small, lineHeight: 20, marginTop: spacing.sm },
  input: { color: colors.white, flexGrow: 1, fontSize: typography.body, lineHeight: 24, marginTop: spacing.xl, minHeight: 88, padding: 0, textAlignVertical: 'top' },
  counter: { color: colors.textMuted, fontSize: typography.label, marginTop: spacing.sm, textAlign: 'right' },
  error: { color: colors.danger, fontSize: typography.small, lineHeight: 19, marginTop: spacing.sm },
});
