import { useState } from 'react';
import { Text, View } from 'react-native';
import type { QuestAction, QuestRoom } from '../../../packages/contracts/src/quest';
import { AppButton } from '@/components/app-button';
import { FormField } from '@/components/form-field';
import { questStyles as s } from './quest-styles';
import { BudgetRecommendation } from './budget-recommendation';

export const money = (amount: number) => `RM ${amount.toLocaleString('en-MY')}`;
export function BudgetStage({ room, busy, act }: { room: QuestRoom; busy: boolean; act: (action: QuestAction) => Promise<boolean> }) {
  const [value, setValue] = useState(room.ownBudget?.toString() ?? '');
  const amount = /^\d+$/.test(value.trim()) ? Number(value) : NaN;
  const valid = Number.isSafeInteger(amount) && amount > 0 && amount <= 1_000_000;
  const allReady = room.members.every((member) => member.budgetSubmitted);
  return <View style={s.stack}>
    <BudgetRecommendation key={`${room.tripId}:${room.selectedCountryCode}:${room.period?.startsOn}:${room.period?.endsOn}:${room.attractionIds.join(',')}:${room.members.length}`} tripId={room.tripId} disabled={busy || !room.selectedCountryCode || !room.period} onApply={(recommended) => setValue(String(recommended))} />
    <View style={s.panel}>
      <Text style={s.heading}>A comfortable limit, just for you.</Text>
      <Text style={s.body}>What’s the most you’d like to spend for the whole trip, including travel, stays, food and activities?</Text>
      <FormField label="My maximum per person (MYR)" hint="Your answer is not shown beside your name. Everyone sees the group spending ceiling. Use a whole ringgit amount." keyboardType="number-pad" maxLength={7} value={value} onChangeText={setValue} placeholder="e.g. 2500" error={value && !valid ? 'Enter a whole amount from RM 1 to RM 1,000,000.' : undefined} />
      {room.ownBudget ? <Text style={s.small}>Your saved limit: {money(room.ownBudget)}</Text> : null}
      <AppButton label={room.ownBudget ? 'Update my budget' : 'Play my budget card'} testID="submit-quest-budget" disabled={!valid} loading={busy} onPress={() => void act({ type: 'budget', amount })} />
    </View>
    {allReady && room.budgetSummary ? <View style={s.success}>
      <Text style={s.kicker}>EVERYONE’S COMFORT ZONE</Text>
      <Text style={s.title}>{money(room.budgetSummary.comfortablePerPerson)}</Text>
      <Text style={s.strong}>per person · for the whole trip</Text>
      <Text style={s.body}>This ceiling fits every submitted limit. It’s a planning target; actual trip costs still need to be checked.</Text>
    </View> : <Text style={s.body}>The group’s spending ceiling unlocks when everyone has played a budget card. We use the lowest limit so no one is pushed above their budget.</Text>}
    {room.currentRole === 'organizer' ? <AppButton label="Continue to Logistics" testID="finish-trip-quest" disabled={!allReady} loading={busy} onPress={() => void act({ type: 'finish' })} /> : <Text style={s.small}>{allReady ? 'The organiser can now open Logistics.' : 'Logistics unlocks after everyone submits.'}</Text>}
  </View>;
}
