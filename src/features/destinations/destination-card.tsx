import { StyleSheet, Text, View } from 'react-native';

import type { DestinationCard as DestinationCardValue } from '../../../packages/contracts/src/destination';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export function DestinationCard({ destination }: { destination: DestinationCardValue }) {
  const estimate = destination.estimate.minimum === null
    ? destination.estimate.evidence.label
    : `${destination.estimate.currency} ${destination.estimate.minimum}–${destination.estimate.maximum} · ${destination.estimate.evidence.label}`;
  return <View style={[styles.card, !destination.eligible ? styles.nearMatch : null]} testID={`destination-${destination.destinationId}`}>
    <View style={styles.heading}><View style={styles.nameBlock}><Text style={styles.name}>{destination.name}</Text>{destination.country ? <Text style={styles.country}>{destination.country}</Text> : null}</View><Text style={[styles.confidence, destination.confidence.level === 'low' ? styles.low : null]}>{destination.confidence.label}</Text></View>
    {!destination.supported ? <Text accessibilityRole="alert" style={styles.warning}>Not in the launch catalogue · lower-confidence comparison</Text> : null}
    {!destination.eligible ? <Text style={styles.excluded}>NEAR MATCH · Review {destination.excludedBy.map((item) => item.replace('_', ' ')).join(', ')}</Text> : null}
    <View style={styles.metrics}><View style={styles.metric}><Text style={styles.label}>ESTIMATE</Text><Text style={styles.value}>{estimate}</Text></View><View style={styles.metric}><Text style={styles.label}>TRAVEL TIME</Text>{destination.travelTimes.length ? destination.travelTimes.map((route) => <Text key={route.origin} style={styles.value}>{route.origin}: {route.minutes === null ? route.evidence.label : `${Math.floor(route.minutes / 60)}h ${route.minutes % 60}m · ${route.evidence.label}`}</Text>) : <Text style={styles.value}>Travel time: Unavailable</Text>}</View></View>
    <Text style={styles.label}>WHY IT MATCHES</Text>
    {destination.matchReasons.length ? destination.matchReasons.map((reason) => <Text key={reason} style={styles.reason}>• {reason}</Text>) : <Text style={styles.muted}>No verified match reasons are available.</Text>}
    <Text style={[styles.label, styles.space]}>INTERESTS</Text><View style={styles.tags}>{destination.interests.length ? destination.interests.map((interest) => <Text key={interest} style={styles.tag}>{interest}</Text>) : <Text style={styles.muted}>Unavailable</Text>}</View>
    <View style={styles.compromise}><Text style={styles.label}>PRIMARY COMPROMISE</Text><Text style={styles.value}>{destination.primaryCompromise}</Text></View>
    {destination.confidence.warning ? <Text style={styles.warning}>{destination.confidence.warning}</Text> : null}
    <View style={styles.provenance}><Text style={styles.label}>CONFIDENCE & PROVENANCE</Text>{destination.provenance.map((item, index) => <Text key={`${item.label}:${index}`} style={styles.provenanceLine}>{item.label}{item.sourceLabel ? ` · ${item.sourceLabel}` : ''}</Text>)}</View>
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, gap: spacing.md, padding: spacing.xl }, nearMatch: { borderColor: colors.gold },
  heading: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' }, nameBlock: { flex: 1 }, name: { color: colors.ink, fontSize: typography.heading, fontWeight: '900' }, country: { color: colors.textMuted, fontSize: typography.small, marginTop: spacing.xs },
  confidence: { backgroundColor: colors.sky, borderRadius: radius.pill, color: colors.ink, fontSize: 10, fontWeight: '900', overflow: 'hidden', paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, low: { backgroundColor: colors.gold },
  metrics: { gap: spacing.md }, metric: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, gap: spacing.xs, paddingBottom: spacing.md }, label: { color: colors.gold, fontSize: typography.label, fontWeight: '900', letterSpacing: 1 }, value: { color: colors.ink, fontSize: typography.small, lineHeight: 20 }, reason: { color: colors.ink, fontSize: typography.small, lineHeight: 20 }, muted: { color: colors.textMuted, fontSize: typography.small },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, tag: { backgroundColor: colors.surfaceTint, borderRadius: radius.pill, color: colors.ink, fontSize: typography.label, overflow: 'hidden', paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, space: { marginTop: spacing.sm },
  compromise: { backgroundColor: colors.surfaceTint, borderRadius: radius.md, gap: spacing.sm, padding: spacing.lg }, warning: { color: colors.gold, fontSize: typography.small, lineHeight: 20 }, excluded: { color: colors.danger, fontSize: typography.label, fontWeight: '900' }, provenance: { gap: spacing.xs }, provenanceLine: { color: colors.textMuted, fontSize: typography.label, lineHeight: 17 },
});

