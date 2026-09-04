import { StyleSheet, Text, View } from 'react-native';

import type { PreferenceRound } from '../../../packages/contracts/src/preferences';
import { preferenceChoiceFor, roundLabel } from '@/features/cards/card-definitions';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export function RoundReveal({ round }: { round: PreferenceRound }) {
  const counts = new Map<string, number>(); round.revealedSubmissions.forEach((item) => counts.set(item.choiceId, (counts.get(item.choiceId) ?? 0) + 1));
  const leading = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const summary = leading ? `${leading[1]} traveller${leading[1] === 1 ? '' : 's'} leaned toward ${preferenceChoiceFor(round.kind, leading[0])?.title ?? 'a custom choice'}. Other choices remain part of the plan.` : 'No cards were played before this round closed.';
  return <View accessibilityLiveRegion="polite" style={styles.reveal} testID="round-reveal">
    <Text style={styles.kicker}>{roundLabel(round.kind).toUpperCase()} · REVEALED</Text><Text style={styles.title}>Cards on the table</Text><Text style={styles.summary}>{summary}</Text>
    <View style={styles.cards}>{round.revealedSubmissions.map((submission) => { const definition = preferenceChoiceFor(round.kind, submission.choiceId); return <View key={submission.memberId} style={[styles.card, { borderTopColor: definition?.accentColor ?? colors.sky }]}><Text style={styles.name}>{submission.displayName}{submission.discriminator > 1 ? ` · ${submission.discriminator}` : ''}</Text><Text style={styles.choice}>{submission.customText || definition?.title || submission.value}</Text><Text style={styles.meaning}>{submission.customText ? 'Personal Must-Have' : definition?.description}</Text></View>; })}</View>
  </View>;
}
const styles = StyleSheet.create({ reveal: { marginTop: spacing.lg }, kicker: { color: colors.gold, fontSize: typography.label, fontWeight: '900', letterSpacing: 1.2 }, title: { color: colors.white, fontSize: typography.heading, fontWeight: '900', marginTop: spacing.sm }, summary: { color: colors.textMuted, fontSize: typography.body, lineHeight: 23, marginTop: spacing.sm }, cards: { gap: spacing.md, marginTop: spacing.lg }, card: { backgroundColor: colors.midnightRaised, borderRadius: radius.md, borderTopWidth: 3, padding: spacing.lg }, name: { color: colors.textMuted, fontSize: typography.label, fontWeight: '800' }, choice: { color: colors.white, fontSize: typography.body, fontWeight: '900', marginTop: spacing.sm }, meaning: { color: colors.textMuted, fontSize: typography.small, marginTop: spacing.xs } });
