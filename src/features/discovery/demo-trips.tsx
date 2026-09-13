import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/app-button';
import { questStyles as s } from '@/features/quest/quest-styles';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { demoTrips } from './demo-trip-data';

export function DemoTrips() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [requested, setRequested] = useState<string[]>([]);
  return <View style={s.stack}>
    <Text accessibilityRole="header" style={s.heading}>Trips to explore</Text>
    <Text style={s.small}>Demo trips with fictional hosts, sample itineraries and estimated budgets. Requests are simulated for this demo.</Text>
    {demoTrips.map(trip => {
      const open = expanded === trip.id;
      const sent = requested.includes(trip.id);
      return <View key={trip.id} style={styles.card}>
        <View pointerEvents="none" style={styles.accent} />
        <View style={styles.intro}>
          <View style={styles.kickerRow}>
            <View style={styles.dot} />
            <Text style={styles.kicker}>DEMO TRIP · {trip.destination}</Text>
          </View>
          <Text accessibilityRole="header" style={styles.title}>{trip.name}</Text>
          <Text style={s.body}>{trip.description}</Text>
        </View>
        <View style={styles.facts}>
          <View style={styles.fact}>
            <Text style={styles.factLabel}>Host</Text>
            <Text style={styles.factValue}>{trip.host}</Text>
          </View>
          <View style={styles.fact}>
            <Text style={styles.factLabel}>Travellers</Text>
            <Text style={styles.factValue}>{trip.travellers} / {trip.capacity}{'\n'}joined</Text>
          </View>
          <View style={styles.fact}>
            <Text style={styles.factLabel}>Dates</Text>
            <Text accessibilityLabel={trip.dates} style={styles.factValue}>{trip.dates.replace('October 2026', 'Oct').replace('November 2026', 'Nov')}</Text>
          </View>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{trip.budget.replace(' per person', '')}</Text>
          <Text style={s.small}>per person</Text>
        </View>
        <View style={styles.button}>
          <AppButton label={open ? 'Hide trip details' : 'View trip details'} onPress={() => setExpanded(open ? null : trip.id)} />
        </View>
        {open ? <View style={s.stack}>
          <Text style={s.strong}>{trip.style}</Text>
          <Text style={s.small}>{trip.dates}</Text>
          <Text accessibilityRole="header" style={s.heading}>The plan</Text>
          {trip.days.map(day => <Text key={day} style={s.body}>{day}</Text>)}
          <Text accessibilityRole="header" style={s.heading}>Budget & meeting point</Text>
          <Text style={s.body}>{trip.included}</Text>
          <Text style={s.body}>{trip.meeting}</Text>
          <Text style={s.small}>Sample plan only. Accommodation, activities and transport are not booked.</Text>
          <AppButton label={sent ? 'Request sent' : 'Request to join'} disabled={sent} onPress={() => setRequested(current => [...current, trip.id])} />
          {sent ? <Text accessibilityLiveRegion="polite" style={s.body}>Request sent · Demo only. No real host has been contacted.</Text> : null}
        </View> : null}
      </View>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.lg,
    overflow: 'hidden',
  },
  accent: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: 4, backgroundColor: colors.leaf,
  },
  intro: { gap: spacing.sm },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 5, height: 5, borderRadius: radius.pill, backgroundColor: colors.orange },
  kicker: { flex: 1, color: colors.sky, fontSize: typography.label, lineHeight: 18, fontWeight: '600' },
  title: { color: colors.ink, fontSize: 22, lineHeight: 27, fontWeight: '700' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  fact: {
    flexGrow: 1, flexBasis: 80, minWidth: 80,
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, gap: spacing.xs,
  },
  factLabel: { color: colors.textMuted, fontSize: typography.label, lineHeight: 17 },
  factValue: { color: colors.ink, fontSize: typography.body, lineHeight: 20, fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm },
  price: { color: colors.ink, fontSize: typography.heading, lineHeight: 27, fontWeight: '700' },
  button: { borderRadius: radius.pill, overflow: 'hidden' },
});
