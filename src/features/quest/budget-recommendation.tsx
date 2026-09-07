import { useState } from 'react';
import { Text, View } from 'react-native';
import { AppButton } from '@/components/app-button';
import { FormField } from '@/components/form-field';
import { budgetTotal, type BudgetEstimate } from '../../../packages/contracts/src/budget-recommendation';
import { recommendBudget } from './recommend-budget';
import { questStyles as s } from './quest-styles';

const categories = { accommodation: 'Accommodation', food: 'Food', localTransport: 'Local transport', activities: 'Activities', returnTravel: 'Return travel', contingency: 'Contingency' } as const;
export function BudgetRecommendation({ tripId, disabled, onApply }: { tripId: string; disabled: boolean; onApply: (amount: number) => void }) {
  const [departure, setDeparture] = useState('Kuala Lumpur'); const [style, setStyle] = useState<'budget' | 'comfortable' | 'premium'>('comfortable');
  const [estimate, setEstimate] = useState<BudgetEstimate | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function recommend() {
    setBusy(true); setError(''); setEstimate(null);
    try {
      setEstimate(await recommendBudget({ tripId, departure: departure.trim(), style }));
    } catch(e) { setError(e instanceof Error ? e.message : 'Please try again.'); } finally { setBusy(false); }
  }
  return <View style={s.panel}><Text style={s.heading}>Let AI recommend your budget</Text><Text style={s.body}>A country-specific estimate for your dates and selected stops, in MYR per person.</Text>
    <FormField label="Departure city" value={departure} editable={!busy} onChangeText={v => { setDeparture(v); setEstimate(null); }} maxLength={120} />
    <View style={s.row}>{(['budget', 'comfortable', 'premium'] as const).map(option => <AppButton key={option} label={option === style ? `✓ ${option}` : option} variant="secondary" disabled={busy} onPress={() => { setStyle(option); setEstimate(null); }} />)}</View>
    <AppButton label="Recommend my budget" disabled={disabled || departure.trim().length < 2} loading={busy} onPress={() => void recommend()} />
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    {estimate ? <View style={s.stack}><Text style={s.title}>RM {budgetTotal(estimate).toLocaleString('en-MY')}</Text><Text style={s.strong}>per person · whole trip</Text>
      {Object.entries(categories).map(([key, label]) => <Text key={key} style={s.body}>{label}: RM {estimate[key as keyof typeof categories].toLocaleString('en-MY')}</Text>)}
      {estimate.assumptions.map((assumption, i) => <Text key={i} style={s.small}>{assumption}</Text>)}
      <Text style={s.small}>AI planning estimate, not live pricing. Review the assumptions and confirm fares before booking.</Text>
      <AppButton label="Use this amount in my budget" disabled={disabled} variant="secondary" onPress={() => onApply(budgetTotal(estimate))} />
    </View> : null}
  </View>;
}
