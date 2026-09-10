import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Attraction } from '../../../packages/contracts/src/countries';
import type { QuestRoom } from '../../../packages/contracts/src/quest';
import { colors, radius, spacing } from '@/theme/tokens';

export function CrewChoices({ room, places }: { room: QuestRoom; places: Attraction[] }) {
  const [showVoters, setShowVoters] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const ballots = (room.attractionVotes ?? []).filter((ballot) => ballot.attractionIds.length && room.members.some((member) => member.memberId === ballot.memberId));
  const choices = places.map((place) => ({ place, voters: ballots.filter((ballot) => ballot.attractionIds.includes(place.id)) }))
    .filter(({ voters }) => voters.length > 0).sort((a, b) => b.voters.length - a.voters.length);
  if (!choices.length) return null;
  const complete = ballots.length === room.members.length;
  return <View style={styles.panel}>
    <View style={styles.header}>
      <Text accessibilityRole="header" style={styles.title}>Your crew’s choices</Text>
      <Text style={styles.total}>{choices.length} {choices.length === 1 ? 'place' : 'places'}</Text>
    </View>
    <Text accessibilityLiveRegion="polite" style={styles.status}>{complete ? 'Everyone has voted' : `${ballots.length} of ${room.members.length} travellers have voted`} · Most voted first</Text>
    <View style={styles.list}>
      {(showAll ? choices : choices.slice(0, 5)).map(({ place, voters }) => {
        const own = voters.some((voter) => voter.memberId === room.currentMemberId);
        return <View key={place.id} style={styles.item}>
          <View style={styles.row}>
            <View style={styles.place}>
              <Text style={styles.name}>{place.name}</Text>
              <Text style={styles.meta}>{place.category}{own ? ' · You voted' : ''}{voters.length === room.members.length ? ' · Everyone’s pick' : ''}</Text>
            </View>
            <View style={styles.tally} accessibilityLabel={`${voters.length} ${voters.length === 1 ? 'vote' : 'votes'} out of ${room.members.length} travellers`} accessible>
              <Text style={styles.number}>{voters.length}<Text style={styles.denominator}> / {room.members.length}</Text></Text>
              <Text style={styles.voteLabel}>{voters.length === 1 ? 'vote' : 'votes'}</Text>
            </View>
          </View>
          {showVoters ? <Text style={styles.voters}>Voted by {voters.map((voter) => voter.memberId === room.currentMemberId ? 'you' : room.members.find((member) => member.memberId === voter.memberId)?.displayName ?? 'Traveller').join(', ')}</Text> : null}
        </View>;
      })}
    </View>
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: showVoters }} onPress={() => setShowVoters(!showVoters)} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><Text style={styles.link}>{showVoters ? 'Hide voters' : 'See who voted'}</Text></Pressable>
      {choices.length > 5 ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: showAll }} onPress={() => setShowAll(!showAll)} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><Text style={styles.link}>{showAll ? 'Show fewer places' : `Show all ${choices.length} places`}</Text></Pressable> : null}
    </View>
    <Text style={styles.footnote}>Every voted place is included when your organiser compiles the stops.</Text>
  </View>;
}

const styles = StyleSheet.create({
  panel: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { color: colors.ink, fontSize: 21, lineHeight: 28, fontWeight: '800' },
  total: { color: colors.sky, fontSize: 13, fontWeight: '600' },
  status: { color: colors.textMuted, fontSize: 13, lineHeight: 20, marginTop: spacing.sm },
  list: { marginTop: spacing.md },
  item: { paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  place: { flex: 1, gap: 5 },
  name: { color: colors.ink, fontSize: 16, lineHeight: 23, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: 12, lineHeight: 19 },
  tally: { alignItems: 'flex-end', minWidth: 52 },
  number: { color: colors.sky, fontSize: 23, lineHeight: 29, fontWeight: '700', fontVariant: ['tabular-nums'] },
  denominator: { color: colors.textMuted, fontSize: 12, fontWeight: '400' },
  voteLabel: { color: colors.textMuted, fontSize: 12 },
  voters: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: spacing.lg, marginTop: spacing.xs },
  action: { minHeight: 44, justifyContent: 'center' },
  link: { color: colors.sky, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  pressed: { opacity: 0.65 },
  footnote: { color: colors.textMuted, fontSize: 12, lineHeight: 19, marginTop: spacing.xs },
});
