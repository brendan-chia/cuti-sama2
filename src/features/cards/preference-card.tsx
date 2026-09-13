import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PreferenceChoice } from '../../../packages/contracts/src/preferences';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const sceneMarks: Record<string, string> = {
  'moon-cabin': '☾ ⌂', hammock: '◡ ☼', 'night-market': '✦ ✦', mountain: '△ ↗', 'sun-and-trail': '☼ ≋',
  sunrise: '☼ —', timeline: '● ┄ ●', 'route-map': '● ╱ ●', 'open-road': '◇ ↝', 'food-stall': '⌂ ♨',
  waterfall: '≈ ↓', heritage: '▥ ◇', rafting: '≈ ▲', 'music-night': '♪ ✦', 'shopping-bag': '▢ ◇',
  'hot-spring': '≋ ♨', postcard: '✦ ▱',
};

type Props = { card: PreferenceChoice; selected: boolean; customText?: string | null; disabled?: boolean; onPress?: () => void; compact?: boolean; accessibilityHint?: string };

export function PreferenceCard({ card, selected, customText, disabled = false, onPress, compact = false, accessibilityHint }: Props) {
  return <Pressable
    accessibilityHint={accessibilityHint ?? `${card.accessibilityHint} Double tap to select this card.`}
    accessibilityLabel={customText || card.accessibilityLabel}
    accessibilityRole="radio"
    aria-disabled={disabled} aria-checked={selected} accessibilityState={{ disabled, selected, checked: selected }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [styles.card, compact ? styles.compact : null, { borderColor: selected ? colors.sky : colors.border }, selected ? styles.selected : null, pressed ? styles.pressed : null]}
    testID={`preference-card-${card.roundType}-${card.id}`}
  >
    <View style={[styles.illustration, { backgroundColor: `${card.accentColor}22` }]}>
      <View style={[styles.sun, { backgroundColor: card.accentColor }]} />
      <View style={[styles.horizon, { borderColor: card.accentColor }]} />
      <Text style={[styles.sceneMark, { color: card.accentColor }]}>{sceneMarks[card.illustration] ?? '✦'}</Text>
    </View>
    <View style={styles.copy}>
      <Text style={styles.title}>{customText || card.title}</Text>
      <Text style={styles.description}>{customText ? 'Your personal Must-Have' : card.description}</Text>
    </View>
    {selected ? <Text style={[styles.selectedLabel, { color: colors.sky }]}>SELECTED</Text> : null}
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 2, minHeight: 232, overflow: 'hidden', width: 154 },
  compact: { minHeight: 220, width: 140 }, selected: { backgroundColor: colors.surfaceTint, transform: [{ translateY: -6 }, { scale: 1.025 }] }, pressed: { opacity: 0.86 },
  illustration: { height: 108, justifyContent: 'center', overflow: 'hidden', padding: spacing.md },
  sun: { borderRadius: radius.pill, height: 36, opacity: 0.9, position: 'absolute', right: 14, top: 14, width: 36 },
  horizon: { borderRadius: 70, borderTopWidth: 2, bottom: -34, height: 86, left: -8, position: 'absolute', right: -8 },
  sceneMark: { fontSize: 29, fontWeight: '800', letterSpacing: 4 }, copy: { flex: 1, padding: spacing.md },
  title: { color: colors.ink, fontSize: typography.body, fontWeight: '900', letterSpacing: -0.2 },
  description: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: spacing.xs },
  selectedLabel: { fontSize: 12, fontWeight: '700', paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
});
