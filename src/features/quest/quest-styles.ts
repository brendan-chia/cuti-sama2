import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export const questStyles = StyleSheet.create({
  stack: { gap: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap' },
  kicker: { color: colors.sky, fontSize: typography.label, fontWeight: '700', letterSpacing: 0.8 },
  title: { color: colors.ink, fontSize: 30, fontWeight: '700', letterSpacing: -0.8, lineHeight: 37 },
  heading: { color: colors.ink, fontSize: typography.heading, fontWeight: '700', lineHeight: 27 },
  body: { color: colors.textMuted, fontSize: typography.body, lineHeight: 23 },
  small: { color: colors.textMuted, fontSize: typography.small, lineHeight: 21 },
  accent: { color: colors.sky },
  strong: { color: colors.ink, fontSize: 15, lineHeight: 23, fontWeight: '700' },
  panel: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper, borderRadius: radius.md, padding: spacing.lg, gap: spacing.lg },
  success: { backgroundColor: colors.surfaceTint, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm, borderLeftColor: colors.sky, borderLeftWidth: 3 },
  errorPanel: { backgroundColor: colors.errorSurface, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm, borderLeftColor: colors.danger, borderLeftWidth: 3 },
  error: { color: colors.danger, fontSize: typography.small, lineHeight: 20 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.sm },
  chip: { borderColor: colors.border, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.lg, minHeight: 44, justifyContent: 'center' },
  chipSelected: { backgroundColor: colors.sky, borderColor: colors.sky },
  chipText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  chipTextSelected: { color: colors.paper },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
  link: { color: colors.sky, fontSize: 13, fontWeight: '700', paddingVertical: spacing.md, minHeight: 44 },
});
