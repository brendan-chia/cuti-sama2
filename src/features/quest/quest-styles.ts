import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export const questStyles = StyleSheet.create({
  stack: { gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  kicker: { color: colors.sky, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 32, fontWeight: '800', letterSpacing: -0.7, lineHeight: 39 },
  heading: { color: colors.ink, fontSize: typography.heading, fontWeight: '800', lineHeight: 26 },
  body: { color: colors.textMuted, fontSize: typography.body, lineHeight: 23 },
  small: { color: colors.textMuted, fontSize: typography.small, lineHeight: 19 },
  accent: { color: colors.sky },
  strong: { color: colors.ink, fontWeight: '800' },
  panel: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md },
  success: { backgroundColor: colors.surfaceTint, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm, borderLeftColor: colors.sky, borderLeftWidth: 3 },
  errorPanel: { backgroundColor: colors.errorSurface, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm, borderLeftColor: colors.danger, borderLeftWidth: 3 },
  error: { color: colors.danger, fontSize: typography.small, lineHeight: 20 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.sm },
  chip: { borderColor: colors.border, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.lg, minHeight: 44, justifyContent: 'center' },
  chipSelected: { backgroundColor: colors.sky, borderColor: colors.sky },
  chipText: { color: colors.ink, fontSize: typography.small, fontWeight: '700' },
  chipTextSelected: { color: colors.paper },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
  link: { color: colors.sky, fontSize: typography.small, fontWeight: '700', paddingVertical: spacing.md },
});
