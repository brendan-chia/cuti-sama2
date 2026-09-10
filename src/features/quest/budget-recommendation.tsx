import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/theme/tokens';
import { AppButton } from '@/components/app-button';
import { FormField } from '@/components/form-field';
import { budgetTotal, type BudgetEstimate } from '../../../packages/contracts/src/budget-recommendation';
import { recommendBudget } from './recommend-budget';
import { questStyles as s } from './quest-styles';

const categories = { accommodation: 'Accommodation', food: 'Food', localTransport: 'Local transport', activities: 'Activities', returnTravel: 'Return travel', contingency: 'Contingency' } as const;

export function EstimateIncludes({ assumptions }: { assumptions: string[] }) {
  const [index, setIndex] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const current = Math.min(index, Math.max(0, assumptions.length - 1));
  if (!assumptions.length) return null;
  return <View style={styles.notes}>
    <View style={styles.includesHeader}>
      <Text accessibilityRole="header" style={styles.includesTitle}>What this estimate includes</Text>
      {assumptions.length > 1 ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: showAll }} onPress={() => setShowAll(!showAll)} style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}><Text style={styles.link}>{showAll ? 'View cards' : 'View all'}</Text></Pressable> : null}
    </View>
    {showAll ? <View style={styles.allNotes}>{assumptions.map((assumption, i) => <View key={i} style={styles.noteRow}><Text style={styles.noteNumber}>{String(i + 1).padStart(2, '0')}</Text><Text style={styles.note}>{assumption}</Text></View>)}</View> : <>
      <View style={styles.assumptionCard} accessibilityLiveRegion="polite">
        <Text style={styles.cardLabel}>ESTIMATE DETAIL {String(current + 1).padStart(2, '0')}</Text>
        <Text style={styles.cardText}>{assumptions[current]}</Text>
      </View>
      {assumptions.length > 1 ? <View style={styles.navigation}>
        <Text style={styles.counter} accessibilityLiveRegion="polite">{current + 1} of {assumptions.length} details</Text>
        <View style={styles.arrows}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous estimate detail" accessibilityState={{ disabled: current === 0 }} disabled={current === 0} onPress={() => setIndex(current - 1)} style={({ pressed }) => [styles.arrow, current === 0 && styles.inactive, pressed && styles.pressed]}><Text style={styles.arrowText}>←</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Next estimate detail" accessibilityState={{ disabled: current === assumptions.length - 1 }} disabled={current === assumptions.length - 1} onPress={() => setIndex(current + 1)} style={({ pressed }) => [styles.arrow, current === assumptions.length - 1 && styles.inactive, pressed && styles.pressed]}><Text style={styles.arrowText}>→</Text></Pressable>
        </View>
      </View> : null}
    </>}
  </View>;
}
export function BudgetRecommendation({ tripId, disabled, onApply, solo = false }: { solo?: boolean; tripId: string; disabled: boolean; onApply: (amount: number) => void }) {
  const [departure, setDeparture] = useState('Kuala Lumpur'); const [style, setStyle] = useState<'budget' | 'comfortable' | 'premium'>('comfortable');
  const [estimate, setEstimate] = useState<BudgetEstimate | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function recommend() {
    setBusy(true); setError(''); setEstimate(null);
    try {
      setEstimate(await recommendBudget({ tripId, departure: departure.trim(), style }));
    } catch(e) { setError(e instanceof Error ? e.message : 'Please try again.'); } finally { setBusy(false); }
  }
  return <View style={s.panel}><Text style={s.heading}>Let AI recommend your budget</Text><Text style={s.body}>{solo ? 'An estimate for your dates and selected stops, in MYR.' : 'A country-specific estimate for your dates and selected stops, in MYR per person.'}</Text>
    <FormField label="Departure city" value={departure} editable={!busy} onChangeText={v => { setDeparture(v); setEstimate(null); }} maxLength={120} />
    <View style={s.row}>{(['budget', 'comfortable', 'premium'] as const).map(option => <AppButton key={option} label={option === style ? `✓ ${option}` : option} variant="secondary" disabled={busy} onPress={() => { setStyle(option); setEstimate(null); }} />)}</View>
    <AppButton label="Recommend my budget" disabled={disabled || departure.trim().length < 2} loading={busy} onPress={() => void recommend()} />
    {busy ? <Text accessibilityLiveRegion="polite" style={s.small}>Pricing outbound travel, return travel and your stay before calculating your full budget…</Text> : null}
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    {estimate ? <View style={s.stack}>
      <View style={styles.total}><Text style={s.kicker}>ESTIMATED TRIP BUDGET</Text><Text style={styles.amount}>RM {budgetTotal(estimate).toLocaleString('en-MY')}</Text><Text style={s.body}>{solo ? 'For your whole trip' : 'Per person · whole trip'}</Text></View>
      <View><Text style={styles.section}>Cost breakdown</Text>{Object.entries(categories).map(([key, label]) => <View key={key} style={styles.costRow}><Text style={styles.label}>{label}</Text><Text style={styles.cost}>RM {estimate[key as keyof typeof categories].toLocaleString('en-MY')}</Text></View>)}</View>
      <EstimateIncludes key={JSON.stringify(estimate.assumptions)} assumptions={estimate.assumptions} />
      <Text style={s.small}>AI planning estimate, not live pricing. Review the assumptions and confirm fares before booking.</Text>
      <AppButton label="Use this amount in my budget" disabled={disabled} variant="secondary" onPress={() => onApply(budgetTotal(estimate))} />
    </View> : null}
  </View>;
}
const styles = StyleSheet.create({
  total: { paddingVertical: spacing.xl, gap: spacing.sm },
  amount: { color: colors.ink, fontSize: 36, lineHeight: 44, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -1 },
  section: { color: colors.ink, fontSize: 16, lineHeight: 24, fontWeight: '700', marginBottom: spacing.sm },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  label: { color: colors.textMuted, fontSize: 15, lineHeight: 22, flex: 1 },
  cost: { color: colors.ink, fontSize: 15, lineHeight: 22, fontWeight: '600', fontVariant: ['tabular-nums'] },
  notes: { gap: spacing.sm },
  includesHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  includesTitle: { color: colors.ink, fontSize: 16, lineHeight: 24, fontWeight: '700', flexShrink: 1 },
  textButton: { minHeight: 44, justifyContent: 'center' },
  link: { color: colors.sky, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  assumptionCard: { backgroundColor: colors.surfaceTint, borderRadius: radius.md, padding: spacing.xl, minHeight: 156, gap: spacing.md },
  cardLabel: { color: colors.sky, fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  cardText: { color: colors.ink, fontSize: 19, lineHeight: 29, fontWeight: '700' },
  navigation: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  counter: { color: colors.textMuted, fontSize: 13, fontVariant: ['tabular-nums'] },
  arrows: { flexDirection: 'row', gap: spacing.sm },
  arrow: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.surfaceTint, alignItems: 'center', justifyContent: 'center' },
  arrowText: { color: colors.sky, fontSize: 23, fontWeight: '600' },
  inactive: { opacity: 0.35 },
  pressed: { opacity: 0.65 },
  allNotes: { gap: spacing.md },
  noteRow: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm },
  noteNumber: { color: colors.sky, fontSize: 12, lineHeight: 22, fontWeight: '700' },
  note: { color: colors.textMuted, fontSize: 14, lineHeight: 22, flex: 1 },
});
