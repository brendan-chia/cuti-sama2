import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { GroupMatchResult, MatchFactKind } from '../../../packages/contracts/src/group-match';
import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { loadGroupMatch } from '@/features/group-reveal/service';
import { colors, radius, spacing, typography } from '@/theme/tokens';

type Props = {
  tripId: string;
  onBack: () => void;
  onNext: (route: string) => void;
  loadAction?: typeof loadGroupMatch;
};

const sections: { kind: MatchFactKind; title: string; empty: string }[] = [
  { kind: 'agreement', title: 'Common ground', empty: 'No repeated preferences were submitted.' },
  { kind: 'minority_must_have', title: 'Minority Must-haves', empty: 'No minority Must-haves.' },
  { kind: 'dealbreaker', title: 'Dealbreakers', empty: 'No dealbreakers were submitted.' },
  { kind: 'unresolved_conflict', title: 'Still unresolved', empty: 'No unresolved conflicts.' },
];

export function GroupRevealScreen({ tripId, onBack, onNext, loadAction = loadGroupMatch }: Props) {
  const [result, setResult] = useState<GroupMatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { setResult(await loadAction(tripId)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not reveal the group match.'); }
    finally { setLoading(false); }
  }, [loadAction, tripId]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const sources = useMemo(() => new Map(result?.sources.map((source) => [source.sourceId, source])), [result]);

  if (!result) return <Screen scroll={false} testID="group-reveal-loading"><View style={styles.center}><Text style={styles.title}>{loading ? 'Finding the common ground…' : 'The reveal is not ready'}</Text>{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}{error ? <View style={styles.retry}><AppButton label="Try again" onPress={() => void refresh()} testID="retry-reveal" /></View> : null}</View></Screen>;
  return <Screen footer={result.status === 'matched' ? <AppButton label={result.nextAction.label} onPress={() => onNext(result.nextAction.route)} testID={`next-${result.nextAction.kind}`} /> : undefined} testID="group-reveal-screen">
    <Pressable accessibilityRole="button" onPress={onBack}><Text style={styles.back}>‹ Preference room</Text></Pressable>
    <Text style={styles.kicker}>GROUP MATCH · TRACEABLE REVEAL</Text>
    <Text style={styles.title}>{result.prose.heading}</Text>
    <Text style={styles.intro}>{result.prose.summary}</Text>
    <View style={[styles.status, result.status === 'blocked' ? styles.blocked : styles.matched]}>
      <Text style={styles.statusTitle}>{result.status === 'blocked' ? 'No valid match remains' : 'A valid path remains'}</Text>
      <Text style={styles.body}>{result.status === 'blocked' ? 'Resolve the blocking categories below. No destination or plan has been invented.' : 'Every conclusion below is linked to a submitted input.'}</Text>
      {result.status === 'blocked' ? <View style={styles.chips}>{result.blockingCategories.map((category) => <Text key={category} style={styles.blockingChip}>{category.replace('_', ' ').toUpperCase()}</Text>)}</View> : null}
    </View>
    {sections.map((section) => {
      const facts = result.facts.filter((fact) => fact.kind === section.kind);
      return <View key={section.kind} style={styles.section} testID={`section-${section.kind}`}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        {facts.length === 0 ? <Text style={styles.empty}>{section.empty}</Text> : facts.map((fact) => {
          const open = expanded === fact.factId;
          return <View key={fact.factId} style={[styles.fact, fact.kind === 'dealbreaker' ? styles.dealbreaker : null]}>
            <Text style={styles.factTitle}>{fact.title}</Text>
            <Text style={styles.factDetail}>{result.prose.factWording[fact.factId] ?? fact.detail}</Text>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setExpanded(open ? null : fact.factId)} testID={`sources-${fact.factId}`}><Text style={styles.sourceLink}>{open ? 'Hide submitted inputs' : `View ${fact.sourceIds.length} submitted input${fact.sourceIds.length === 1 ? '' : 's'}`}</Text></Pressable>
            {open ? <View style={styles.sourceList}>{fact.sourceIds.map((sourceId) => {
              const source = sources.get(sourceId); if (!source) return null;
              return <View key={sourceId} style={styles.source}><Text style={styles.sourceAttribution}>{source.groupVisible && source.attribution ? source.attribution : 'Private member input'}</Text><Text style={styles.sourceValue}>{source.value}</Text><Text style={styles.sourceMeta}>{source.inputKind === 'preference' ? 'Revealed preference card' : `Submitted ${source.category.replace('_', ' ')}`}</Text></View>;
            })}</View> : null}
          </View>;
        })}
      </View>;
    })}
    {result.prose.source === 'groq' ? <Text style={styles.aiNote}>Wording assisted by AI · match facts remain deterministic</Text> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: spacing.xl }, retry: { marginTop: spacing.xl, width: '100%' },
  back: { color: colors.sky, fontSize: typography.body, marginBottom: spacing.xl }, kicker: { color: colors.gold, fontSize: typography.label, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: colors.ink, fontSize: typography.title, fontWeight: '900', marginTop: spacing.sm }, intro: { color: colors.textMuted, fontSize: typography.body, lineHeight: 24, marginTop: spacing.md },
  status: { borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm, marginTop: spacing.xl, padding: spacing.xl }, matched: { backgroundColor: colors.surface, borderColor: colors.sky }, blocked: { backgroundColor: colors.surface, borderColor: colors.danger },
  statusTitle: { color: colors.ink, fontSize: typography.heading, fontWeight: '800' }, body: { color: colors.textMuted, fontSize: typography.small, lineHeight: 20 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }, blockingChip: { backgroundColor: colors.coral, borderRadius: radius.pill, color: colors.ink, fontSize: 10, fontWeight: '900', overflow: 'hidden', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  section: { gap: spacing.md, marginTop: spacing.xxl }, sectionTitle: { color: colors.ink, fontSize: typography.heading, fontWeight: '800' }, empty: { color: colors.textMuted, fontSize: typography.small },
  fact: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, padding: spacing.lg }, dealbreaker: { borderColor: colors.coral }, factTitle: { color: colors.gold, fontSize: typography.small, fontWeight: '800' }, factDetail: { color: colors.ink, fontSize: typography.body, lineHeight: 23, marginTop: spacing.sm }, sourceLink: { color: colors.sky, fontSize: typography.small, fontWeight: '700', marginTop: spacing.md },
  sourceList: { gap: spacing.sm, marginTop: spacing.md }, source: { backgroundColor: colors.surfaceTint, borderRadius: radius.sm, gap: spacing.xs, padding: spacing.md }, sourceAttribution: { color: colors.gold, fontSize: typography.label, fontWeight: '800' }, sourceValue: { color: colors.ink, fontSize: typography.small, lineHeight: 19 }, sourceMeta: { color: colors.textMuted, fontSize: 10, textTransform: 'uppercase' },
  aiNote: { color: colors.textMuted, fontSize: typography.label, marginTop: spacing.xxl, textAlign: 'center' }, error: { color: colors.danger, fontSize: typography.small, lineHeight: 20, marginTop: spacing.md, textAlign: 'center' },
});

