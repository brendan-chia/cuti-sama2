import { useState } from 'react';
import { Text, View } from 'react-native';
import type { QuestAction, QuestRoom } from '../../../packages/contracts/src/quest';
import { parseBudgetInput } from '../../../packages/contracts/src/budget';
import { AppButton } from '@/components/app-button';
import { FormField } from '@/components/form-field';
import { questStyles as s } from './quest-styles';

export const money = (amount: number) => `RM ${amount.toLocaleString('en-MY')}`;
export function BudgetStage({ room, busy, act }: { room: QuestRoom; busy: boolean; act: (action: QuestAction) => Promise<boolean> }) {
  const solo = room.travelParty === 'solo';
  const [comfortable, setComfortable] = useState(room.ownBudget?.comfortableBudgetMYR.toString() ?? '');
  const [maximum, setMaximum] = useState(room.ownBudget?.maxBudgetMYR.toString() ?? '');
  const parsed = parseBudgetInput(comfortable, maximum);
  const fieldError = (field: string) => !parsed.success ? parsed.error.issues.find(issue => issue.path[0] === field)?.message : undefined;
  const unsaved = !parsed.success || parsed.data.comfortableBudgetMYR !== room.ownBudget?.comfortableBudgetMYR || parsed.data.maxBudgetMYR !== room.ownBudget?.maxBudgetMYR;
  const allReady = room.members.length > 0 && room.members.every(member => member.budgetSubmitted) && room.budgetSummary?.submittedCount === room.members.length;
  return <View style={s.stack}>
    <View style={s.panel}>
      <Text style={s.body}>Your spending per person, for the whole trip.</Text>
      <FormField label="Comfortable spending (RM)" hint="I'm happy spending around this amount." keyboardType="number-pad" maxLength={7} editable={!busy} value={comfortable} onChangeText={setComfortable} placeholder="e.g. 2500" error={comfortable ? fieldError('comfortableBudgetMYR') : undefined} />
      <FormField label="Absolute maximum (RM)" hint="I don't want the whole trip to go above this." keyboardType="number-pad" maxLength={7} editable={!busy} value={maximum} onChangeText={setMaximum} placeholder="e.g. 3500" error={maximum ? fieldError('maxBudgetMYR') : undefined} />
      <Text style={s.small}>Your exact numbers stay private.</Text>
      {room.ownBudget ? <Text accessibilityLiveRegion="polite" style={s.small}>Your budget is saved. You can update it before continuing.</Text> : null}
      <AppButton label={room.ownBudget ? 'Update my budget' : 'Save my budget'} testID="submit-quest-budget" disabled={!parsed.success || busy} loading={busy} onPress={() => { if (parsed.success) void act({ type: 'budget', ...parsed.data }); }} />
    </View>
    {allReady && room.budgetSummary ? !solo ? <View style={s.success} testID="crew-budget-zones">
      <Text style={s.heading}>{solo ? 'Your Comfort Zone' : 'Crew Comfort Zone'}</Text>
      <Text style={s.strong}>Up to {money(room.budgetSummary.crewComfortCeiling)}/person</Text>
      <Text style={s.heading}>Flexible Zone</Text>
      {room.budgetSummary.crewHardCeiling > room.budgetSummary.crewComfortCeiling ? <>
        <Text style={s.strong}>{money(room.budgetSummary.crewComfortCeiling)} – {money(room.budgetSummary.crewHardCeiling)}/person</Text>
        <Text style={s.body}>Above the comfort zone, within every traveller’s maximum.</Text>
      </> : <Text style={s.body}>No extra stretch room beyond the comfort zone.</Text>}
      <Text style={s.strong}>Above {money(room.budgetSummary.crewHardCeiling)}/person</Text>
      <Text style={s.body}>{solo ? 'May exceed your maximum.' : "May exceed someone's maximum."}</Text>
    </View> : null : <Text style={s.small}>{solo ? 'Save your budget to continue.' : 'Your crew’s spending zones appear once everyone saves.'}</Text>}
    {room.ownBudget && unsaved ? <Text style={s.small}>Save your changes before continuing.</Text> : null}
    {room.currentRole === 'organizer' ? <AppButton label="Continue the quest" testID="finish-trip-quest" disabled={!allReady || busy || unsaved} loading={busy} onPress={() => void act({ type: 'finish' })} /> : <Text style={s.small}>{allReady ? 'Your organiser can now continue the quest.' : 'The next chapter unlocks after everyone submits.'}</Text>}
  </View>;
}
