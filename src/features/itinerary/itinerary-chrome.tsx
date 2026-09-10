import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme/tokens';

type TopBarProps = { title: string; onBack: () => void; compact?: boolean };

export function ItineraryTopBar({ title, onBack, compact = false }: TopBarProps) {
  return <View style={[styles.topBar, compact ? styles.compactTopBar : null]}>
    <Pressable accessibilityLabel="Go back" accessibilityRole="button" hitSlop={12} onPress={onBack} style={({ pressed }) => [styles.topAction, pressed ? styles.pressed : null]}><Text style={styles.backIcon}>‹</Text></Pressable>
    <Text numberOfLines={1} style={styles.topTitle}>{title}</Text>

  </View>;
}

type BottomNavProps = { onHome?: () => void; onItinerary?: () => void; onOpen?: () => void; onGroup?: () => void; onMore?: () => void };

export function TripBottomNav({ onOpen }: BottomNavProps) {
  if (!onOpen) return null;
  return <View style={styles.bottomNav}><Pressable accessibilityRole="button" accessibilityLabel="View itinerary details" onPress={onOpen} style={styles.navItem} testID="review-itinerary"><Text style={styles.navLabel}>View itinerary details</Text></Pressable></View>;
}

const styles = StyleSheet.create({
  topBar: { alignItems: 'center', backgroundColor: colors.background, flexDirection: 'row', minHeight: 58, paddingHorizontal: spacing.md },
  compactTopBar: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
  topAction: { alignItems: 'center', height: 48, justifyContent: 'center', width: 48 },
  backIcon: { color: colors.ink, fontSize: 34, fontWeight: '300', lineHeight: 36, marginTop: -2 },
  topTitle: { color: colors.ink, flex: 1, fontSize: typography.body, fontWeight: '800', letterSpacing: .1 },
  topTrailing: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minWidth: 66, justifyContent: 'flex-end' },
  people: { color: colors.ink, fontSize: 19 }, more: { color: colors.ink, fontSize: 24, lineHeight: 26 },
  pressed: { opacity: .66, transform: [{ scale: .97 }] },
  bottomNav: { alignItems: 'flex-end', backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-around', minHeight: 66, paddingBottom: spacing.xs, paddingHorizontal: spacing.sm, paddingTop: spacing.sm },
  navItem: { minHeight: 48, justifyContent: 'center', alignItems: 'center', gap: 2, minWidth: 54 }, navGlyph: { color: colors.textMuted, fontSize: 19, lineHeight: 22 }, navLabel: { color: colors.textMuted, fontSize: 14, fontWeight: '600' }, navActive: { color: colors.sky },
  addButton: { alignItems: 'center', backgroundColor: colors.sky, borderColor: colors.sand, borderRadius: radius.pill, borderWidth: 1, height: 48, justifyContent: 'center', marginBottom: 6, width: 48 }, addGlyph: { color: colors.paper, fontSize: 29, fontWeight: '300', lineHeight: 32 },
});
