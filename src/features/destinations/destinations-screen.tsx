import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { DestinationResult } from '../../../packages/contracts/src/destination';
import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { DestinationCard } from '@/features/destinations/destination-card';
import { loadDestinations } from '@/features/destinations/service';
import { colors, radius, spacing, typography } from '@/theme/tokens';

type Props = { tripId: string; onBack: () => void; onContinue?: () => void; loadAction?: typeof loadDestinations };
const copy = {
  discovery: { kicker: 'DESTINATION DISCOVERY', title: 'Filtered possibilities', intro: 'Up to three enabled catalogue destinations that remain after every hard constraint.' },
  comparison: { kicker: 'SHORTLIST COMPARISON', title: 'The trade-offs, side by side', intro: 'Manual destinations stay visible worldwide; unsupported evidence is clearly marked.' },
  locked: { kicker: 'LOCKED DESTINATION', title: 'Evidence before the itinerary', intro: 'A transparent assessment of the destination already chosen by the group.' },
};

export function DestinationsScreen({ tripId, onBack, onContinue, loadAction = loadDestinations }: Props) {
  const [result, setResult] = useState<DestinationResult | null>(null); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => { setLoading(true); setError(null); try { setResult(await loadAction(tripId)); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not evaluate destinations.'); } finally { setLoading(false); } }, [loadAction, tripId]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  if (!result) return <Screen scroll={false}><View style={styles.center}><Text style={styles.title}>{loading ? 'Checking the catalogue…' : 'Destinations are unavailable'}</Text>{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}{error ? <View style={styles.retry}><AppButton label="Try again" onPress={() => void refresh()} testID="retry-destinations" /></View> : null}</View></Screen>;
  const heading = copy[result.kind];
  return <Screen footer={onContinue && result.destinations.length > 0 ? <AppButton label="Continue to group vote" onPress={onContinue} testID="continue-destination" /> : undefined} testID="destinations-screen">
    <Pressable accessibilityRole="button" onPress={onBack}><Text style={styles.back}>‹ Group match</Text></Pressable>
    <Text style={styles.kicker}>{heading.kicker}</Text><Text style={styles.title}>{heading.title}</Text><Text style={styles.intro}>{heading.intro}</Text>
    {result.noMatch ? <View style={styles.noMatch} testID="destination-no-match"><Text style={styles.noMatchTitle}>No catalogue match remains</Text><Text style={styles.body}>The smallest constraint set to revisit is shown below. Nothing has been changed.</Text><View style={styles.categories}>{result.noMatch.revisionCategories.map((category) => <Text key={category} style={styles.category}>{category.replace('_', ' ').toUpperCase()}</Text>)}</View></View> : null}
    <View style={styles.list}>{result.destinations.map((destination) => <DestinationCard key={destination.destinationId} destination={destination} />)}</View>
    <Text style={styles.legal}>Confidence wording and placeholder catalogue content require product/legal approval before release. Always verify time-sensitive travel information with primary sources.</Text>
  </Screen>;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: spacing.xl }, retry: { marginTop: spacing.xl, width: '100%' }, back: { color: colors.sky, fontSize: typography.body, marginBottom: spacing.xl },
  kicker: { color: colors.coral, fontSize: typography.label, fontWeight: '900', letterSpacing: 1.5 }, title: { color: colors.ink, fontSize: typography.title, fontWeight: '900', marginTop: spacing.sm }, intro: { color: colors.textMuted, fontSize: typography.body, lineHeight: 24, marginTop: spacing.md },
  list: { gap: spacing.lg, marginTop: spacing.xxl }, noMatch: { backgroundColor: colors.surface, borderColor: colors.danger, borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm, marginTop: spacing.xl, padding: spacing.xl }, noMatchTitle: { color: colors.ink, fontSize: typography.heading, fontWeight: '900' }, body: { color: colors.textMuted, fontSize: typography.small, lineHeight: 20 }, categories: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }, category: { backgroundColor: colors.coral, borderRadius: radius.pill, color: colors.ink, fontSize: 10, fontWeight: '900', overflow: 'hidden', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  legal: { color: colors.textMuted, fontSize: typography.label, lineHeight: 17, marginTop: spacing.xxl, textAlign: 'center' }, error: { color: colors.danger, fontSize: typography.small, lineHeight: 20, marginTop: spacing.md, textAlign: 'center' },
});
