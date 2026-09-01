import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import type { TripSummary } from '../../../packages/contracts/src/trip';
import { Screen } from '@/components/screen';
import { planningModeOptions } from '@/features/trips/planning-modes';
import { loadTrip } from '@/features/trips/service';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export default function TripRoomScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [trip, setTrip] = useState<TripSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!tripId) return undefined;
    void loadTrip(tripId)
      .then((value) => {
        if (!active) return;
        if (!value) setError('This Trip Room could not be found.');
        else setTrip(value);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load this Trip Room.');
      });
    return () => {
      active = false;
    };
  }, [tripId]);

  if (!trip && !error) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.coral} size="large" />
          <Text style={styles.loading}>Loading your Trip Room…</Text>
        </View>
      </Screen>
    );
  }

  if (!trip) {
    return (
      <Screen scroll={false}>
        <View accessibilityRole="alert" style={styles.center}>
          <Text style={styles.errorTitle}>We could not open this room</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </Screen>
    );
  }

  const mode = planningModeOptions.find((option) => option.value === trip.mode);

  return (
    <Screen testID="trip-room-created">
      <View style={styles.successBadge}>
        <View style={styles.successDot} />
        <Text style={styles.successLabel}>ROOM CREATED</Text>
      </View>
      <Text style={styles.tripName}>{trip.tripName}</Text>
      <Text style={styles.mode}>{mode?.title}</Text>

      <View style={styles.tableCard}>
        <Text style={styles.tableKicker}>YOUR SHARED TABLE</Text>
        <Text style={styles.tableTitle}>Ready for the group</Text>
        <Text style={styles.tableBody}>
          Your organiser session and room membership are saved. Invitations and the realtime lobby arrive in the next slice.
        </Text>
        {trip.destinations.length ? (
          <View style={styles.destinationList}>
            {trip.destinations.map((destination, index) => (
              <View key={destination} style={styles.destinationRow}>
                <Text style={styles.destinationIndex}>{String(index + 1).padStart(2, '0')}</Text>
                <Text style={styles.destinationName}>{destination}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.discoveryBadge}>
            <Text style={styles.discoveryText}>Destination discovery selected</Text>
          </View>
        )}
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>ROOM ID</Text>
        <Text selectable style={styles.metaValue}>{trip.tripId}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, gap: spacing.lg, justifyContent: 'center' },
  loading: { color: colors.textMuted, fontSize: typography.body },
  errorTitle: { color: colors.white, fontSize: typography.heading, fontWeight: '800' },
  errorText: { color: colors.danger, fontSize: typography.body, lineHeight: 23, textAlign: 'center' },
  successBadge: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.midnightRaised, borderRadius: radius.pill, flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  successDot: { backgroundColor: colors.gold, borderRadius: radius.pill, height: 8, width: 8 },
  successLabel: { color: colors.gold, fontSize: typography.label, fontWeight: '800', letterSpacing: 1.3 },
  tripName: { color: colors.white, fontSize: typography.title, fontWeight: '900', letterSpacing: -0.8, marginTop: spacing.xl },
  mode: { color: colors.textMuted, fontSize: typography.body, marginTop: spacing.sm },
  tableCard: { backgroundColor: colors.midnightRaised, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, gap: spacing.md, marginTop: spacing.xxl, padding: spacing.xl },
  tableKicker: { color: colors.sky, fontSize: typography.label, fontWeight: '800', letterSpacing: 1.5 },
  tableTitle: { color: colors.white, fontSize: typography.heading, fontWeight: '800' },
  tableBody: { color: colors.textMuted, fontSize: typography.body, lineHeight: 24 },
  destinationList: { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, marginTop: spacing.sm },
  destinationRow: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md },
  destinationIndex: { color: colors.coral, fontSize: typography.label, fontWeight: '800' },
  destinationName: { color: colors.sand, flex: 1, fontSize: typography.body, fontWeight: '700' },
  discoveryBadge: { alignSelf: 'flex-start', backgroundColor: colors.sand, borderRadius: radius.pill, marginTop: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  discoveryText: { color: colors.midnight, fontSize: typography.small, fontWeight: '700' },
  metaRow: { gap: spacing.sm, marginTop: spacing.xl },
  metaLabel: { color: colors.textMuted, fontSize: typography.label, fontWeight: '800', letterSpacing: 1.2 },
  metaValue: { color: colors.sky, fontSize: typography.small },
});
