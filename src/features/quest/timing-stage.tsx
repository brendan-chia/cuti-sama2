import { useState } from 'react';
import { Text, View } from 'react-native';
import type { QuestAction, QuestRoom, TripPeriod } from '../../../packages/contracts/src/quest';
import { AppButton } from '@/components/app-button';
import { DateField } from '@/components/date-field';
import { questStyles as s } from './quest-styles';

export function periodLabel(period: Pick<TripPeriod, 'startsOn' | 'endsOn'>) {
  const format = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${format(period.startsOn)} – ${format(period.endsOn)}`;
}

type Props = { room: QuestRoom; busy: boolean; act: (action: QuestAction) => Promise<boolean> };
export function TimingStage({ room, busy, act }: Props) {
  const [startsOn, setStartsOn] = useState(room.ownAvailability?.startsOn ?? '');
  const [endsOn, setEndsOn] = useState(room.ownAvailability?.endsOn ?? '');
  const submitted = room.members.filter((member) => member.availabilitySubmitted).length;
  const allReady = submitted === room.members.length;
  const proposals = allReady ? room.dateProposals ?? [] : [];
  const days = (Date.parse(endsOn) - Date.parse(startsOn)) / 86400000 + 1;
  const valid = Boolean(startsOn && endsOn && days >= 1 && days <= 30);
  return <View style={s.stack}>
    <View style={s.panel}>
      <Text style={s.heading}>Which dates would you propose?</Text>
      <Text style={s.small}>Suggest a trip period you think could work for your crew. Once everyone submits, your name and proposed dates will be shared with everyone.</Text>
      <DateField label="Proposed start date" required value={startsOn} onChange={setStartsOn} />
      <DateField label="Proposed end date" required value={endsOn} minimumDate={startsOn || undefined} onChange={setEndsOn} />
      {room.ownAvailability ? <Text style={s.small}>Your saved proposal: {periodLabel(room.ownAvailability)}</Text> : null}
      <AppButton label={room.ownAvailability ? 'Update my proposed dates' : 'Submit my proposed dates'} testID="save-quest-availability" loading={busy} disabled={!valid} onPress={() => void act({ type: 'availability', startsOn, endsOn })} />
      {startsOn && endsOn && !valid ? <Text style={s.error}>Choose an end date on or after the start, for a trip of up to 30 days.</Text> : null}
    </View>
    <Text accessibilityLiveRegion="polite" style={s.body}>{allReady ? 'Everyone has proposed dates. Compare the options together.' : `${submitted} of ${room.members.length} proposals received. Everyone’s dates will appear once the whole crew submits.`}</Text>
    {allReady ? <View style={s.stack} testID="date-proposals">
      <Text style={s.heading}>Your crew’s proposed dates</Text>
      <Text style={s.small}>Discuss which proposal works best. You can update your own dates until the organiser confirms the group’s choice.</Text>
      {proposals.map((proposal) => {
        const member = room.members.find((item) => item.memberId === proposal.memberId);
        const name = member?.displayName ?? 'Traveller';
        return <View key={proposal.memberId} style={s.panel}>
          <Text style={s.strong}>{name}{proposal.memberId === room.currentMemberId ? ' (you)' : ''}</Text>
          <Text style={s.heading}>{periodLabel(proposal)}</Text>
          {room.currentRole === 'organizer' ? <AppButton label="Confirm these dates & unlock wishlists" testID={`choose-proposal-${proposal.memberId}`} disabled={busy} onPress={() => void act({ type: 'period', period: { startsOn: proposal.startsOn, endsOn: proposal.endsOn, label: 'Crew-proposed travel dates', reason: 'Chosen by the organiser from the crew’s proposed dates.' } })} /> : null}
        </View>;
      })}
      {!proposals.length ? <Text style={s.small}>Loading the shared proposals. Refresh the trip if they do not appear.</Text> : null}
    </View> : null}
  </View>;
}
