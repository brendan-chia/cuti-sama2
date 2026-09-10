import { useState } from 'react';
import { Text, View } from 'react-native';
import { decisionLabel, type DecisionValue, type Workspace, type WorkspaceAction, type WorkspaceDecision } from '../../../packages/contracts/src/workspace';
import { AppButton } from '@/components/app-button';
import { FormField } from '@/components/form-field';
import { DateField } from '@/components/date-field';
import { questStyles as s } from '@/features/quest/quest-styles';

export function DecisionEditor({ workspace, decision, busy, save, close }: { workspace: Workspace; decision: WorkspaceDecision; busy: boolean; save: (action: WorkspaceAction) => Promise<boolean>; close: () => void }) {
  const own = decision.responses.find(item => item.memberId === workspace.currentMemberId);
  const initial = own?.value ?? decision.previous;
  const [destination, setDestination] = useState(initial?.destination ?? '');
  const [start, setStart] = useState(initial?.startsOn ?? ''); const [end, setEnd] = useState(initial?.endsOn ?? '');
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? ''); const [error, setError] = useState('');
  const [reopen, setReopen] = useState(false);
  const organizer = workspace.currentRole === 'organizer';
  async function respond(abstain = false) {
    const value: DecisionValue = abstain ? {} : decision.kind === 'destination' ? { destination: destination.trim() } : decision.kind === 'budget' ? { amount: Number(amount) } : { startsOn: start, endsOn: end };
    if (!abstain && decision.kind === 'dates' && (!start || !end || end < start || (Date.parse(end) - Date.parse(start)) / 86400000 > 29)) { setError('Choose a date range of 1 to 30 days.'); return; }
    if (!abstain && decision.kind === 'budget' && (!/^\d+$/.test(amount) || Number(amount) < 1 || Number(amount) > 1_000_000)) { setError('Enter a whole amount from RM 1 to RM 1,000,000.'); return; }
    if (!abstain && decision.kind === 'destination' && !destination.trim()) { setError('Enter a destination or choose to let others decide.'); return; }
    setError(''); if (await save({ type: 'respond', kind: decision.kind, value, abstain })) close();
  }
  return <View style={s.stack}>
    <AppButton label="Back to overview" variant="secondary" onPress={close} />
    <Text accessibilityRole="header" style={s.title}>{decision.kind === 'dates' ? 'When can you travel?' : decision.kind === 'destination' ? 'Where would you like to go?' : 'What is your budget?'}</Text>
    {decision.status === 'confirmed' ? <>
      <Text style={s.body}>{decisionLabel(decision.confirmed)}</Text><Text style={s.small}>Confirmed · Version {decision.version}</Text>
      {organizer ? reopen ? <><Text style={s.body}>Reopening asks everyone to respond again. Your itinerary and bookings will be marked for review; the previous decision is kept.</Text><AppButton label="Reopen and request new responses" disabled={busy} onPress={() => void save({ type: 'reopen', kind: decision.kind })} /><AppButton label="Keep confirmed decision" variant="secondary" onPress={() => setReopen(false)} /></> : <AppButton label="Reopen decision" variant="secondary" onPress={() => setReopen(true)} /> : null}
    </> : <>
      {decision.kind === 'destination' ? <FormField label="Destination" hint="Use the same city or country name as your group to confirm a shared choice." value={destination} onChangeText={setDestination} maxLength={120} /> : decision.kind === 'dates' ? <><DateField label="Start date" value={start} onChange={setStart} /><DateField label="End date" value={end} minimumDate={start || undefined} onChange={setEnd} /></> : <FormField label="My maximum per person (MYR)" hint="For the whole trip, including transport, stays, food and activities. Your individual amount is private." keyboardType="number-pad" value={amount} onChangeText={setAmount} maxLength={7} />}
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
      <AppButton label="Save my response" loading={busy} onPress={() => void respond()} />
      <AppButton label="Let the responding travellers decide" disabled={busy} variant="secondary" onPress={() => void respond(true)} />
      <Text style={s.small}>This records your explicit abstention. Leaving without responding does not count as agreement.</Text>
      <Text style={s.heading}>Responses</Text>
      {workspace.members.map(member => { const response = decision.responses.find(item => item.memberId === member.memberId); return <View key={member.memberId}><Text style={s.strong}>{member.name}{member.memberId === workspace.currentMemberId ? ' (you)' : ''}</Text><Text style={s.body}>{!response ? 'Not responded' : response.abstain ? 'Letting others decide' : decision.kind === 'budget' && member.memberId !== workspace.currentMemberId ? 'Budget saved privately' : decisionLabel(response.value)}</Text></View>; })}
      <Text style={s.small}>{decision.kind === 'budget' ? 'The lowest submitted maximum becomes the shared limit. With small groups, this aggregate may reveal a limit indirectly.' : 'Dates and destination must match across the responding travellers before confirmation. Different choices are not silently overridden.'}</Text>
      {organizer ? <><AppButton label="Confirm shared decision" disabled={busy || decision.responses.length !== workspace.members.length} onPress={() => void save({ type: 'confirm', kind: decision.kind })} /><Text style={s.small}>Confirmation needs a response or explicit abstention from each traveller. You can keep working on your draft meanwhile.</Text></> : <Text style={s.small}>The organiser confirms the decision after everyone responds.</Text>}
    </>}
  </View>;
}
