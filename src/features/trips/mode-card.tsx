import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PlanningMode } from '../../../packages/contracts/src/trip';
import type { PlanningModeOption } from '@/features/trips/planning-modes';
import { colors, radius, spacing, typography } from '@/theme/tokens';

type ModeCardProps = {
  option: PlanningModeOption;
  selected: boolean;
  onSelect: (mode: PlanningMode) => void;
};

export function ModeCard({ option, selected, onSelect }: ModeCardProps) {
  return (
    <Pressable
      accessibilityLabel={option.title}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={() => onSelect(option.value)}
      style={({ pressed }) => [
        styles.card,
        selected ? styles.selectedCard : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.topRow}>
        <Text style={[styles.step, selected ? styles.selectedStep : null]}>{option.step}</Text>
        <Text style={[styles.eyebrow, selected ? styles.selectedEyebrow : null]}>
          {option.eyebrow}
        </Text>
        <View style={[styles.radio, selected ? styles.radioSelected : null]}>
          {selected ? <View style={styles.radioDot} /> : null}
        </View>
      </View>
      <Text style={[styles.title, selected ? styles.selectedText : null]}>{option.title}</Text>
      <Text style={[styles.description, selected ? styles.selectedDescription : null]}>
        {option.description}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.midnightRaised,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    minHeight: 148,
    padding: spacing.lg,
  },
  selectedCard: { backgroundColor: colors.sand, borderColor: colors.sand },
  pressed: { opacity: 0.84 },
  topRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  step: {
    color: colors.sky,
    fontSize: typography.label,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  selectedStep: { color: colors.coralPressed },
  eyebrow: {
    color: colors.textMuted,
    flex: 1,
    fontSize: typography.label,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  selectedEyebrow: { color: colors.midnightSoft },
  radio: {
    alignItems: 'center',
    borderColor: colors.disabled,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  radioSelected: { borderColor: colors.coral },
  radioDot: {
    backgroundColor: colors.coral,
    borderRadius: radius.pill,
    height: 12,
    width: 12,
  },
  title: {
    color: colors.white,
    fontSize: typography.heading,
    fontWeight: '800',
    lineHeight: 26,
  },
  selectedText: { color: colors.midnight },
  description: { color: colors.textMuted, fontSize: typography.small, lineHeight: 20 },
  selectedDescription: { color: colors.midnightSoft },
});
