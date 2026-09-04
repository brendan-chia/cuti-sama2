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
    accessibilityState={{ disabled, selected }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [styles.card, compact ? styles.compact : null, { borderColor: selected ? card.accentColor : colors.border }, selected ? styles.selected : null, pressed ? styles.pressed : null]}
    testID={`preference-card-${card.roundType}-${card.id}`}
  >
    <View style={[styles.illustration, { backgroundColor: `${card.accentColor}22` }]}>
      <View style={[styles.sun, { backgroundColor: card.accentColor }]} />
      <View style={[styles.horizon, { borderColor: card.accentColor }]} />
      <Text style={[styles.sceneMark, { color: card.accentColor }]}>{sceneMarks[card.illustration] ?? '✦'}</Text>
    </View>
    <View style={styles.copy}>
      <Text numberOfLines={2} style={styles.title}>{customText || card.title}</Text>
      <Text numberOfLines={3} style={styles.description}>{customText ? 'Your personal Must-Have' : card.description}</Text>
    </View>
    {selected ? <Text style={[styles.selectedLabel, { color: card.accentColor }]}>SELECTED</Text> : null}
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.midnightRaised, borderRadius: radius.md, borderWidth: 2, height: 232, overflow: 'hidden', width: 154 },
  compact: { height: 206, width: 140 }, selected: { transform: [{ translateY: -6 }, { scale: 1.025 }] }, pressed: { opacity: 0.86 },
  illustration: { height: 108, justifyContent: 'center', overflow: 'hidden', padding: spacing.md },
  sun: { borderRadius: radius.pill, height: 36, opacity: 0.9, position: 'absolute', right: 14, top: 14, width: 36 },
  horizon: { borderRadius: 70, borderTopWidth: 2, bottom: -34, height: 86, left: -8, position: 'absolute', right: -8 },
  sceneMark: { fontSize: 29, fontWeight: '800', letterSpacing: 4 }, copy: { flex: 1, padding: spacing.md },
  title: { color: colors.white, fontSize: typography.body, fontWeight: '900', letterSpacing: -0.2 },
  description: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: spacing.xs },
  selectedLabel: { bottom: spacing.sm, fontSize: 9, fontWeight: '900', letterSpacing: 1.1, position: 'absolute', right: spacing.md },
});
