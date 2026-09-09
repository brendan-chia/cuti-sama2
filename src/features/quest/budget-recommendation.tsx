import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/theme/tokens';
import { AppButton } from '@/components/app-button';
import { FormField } from '@/components/form-field';
import { budgetTotal, type BudgetEstimate } from '../../../packages/contracts/src/budget-recommendation';
import { recommendBudget } from './recommend-budget';
import { questStyles as s } from './quest-styles';

const categories = { accommodation: 'Accommodation', food: 'Food', localTransport: 'Local transport', activities: 'Activities', returnTravel: 'Return travel', contingency: 'Contingency' } as const;
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
      <View style={styles.notes}><Text style={styles.section}>What this estimate includes</Text>{estimate.assumptions.map((assumption, i) => <View key={i} style={styles.noteRow}><Text style={s.small}>•</Text><Text style={styles.note}>{assumption}</Text></View>)}</View>
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
  noteRow: { flexDirection: 'row', gap: spacing.sm },
  note: { color: colors.textMuted, fontSize: 14, lineHeight: 22, flex: 1 },
});
