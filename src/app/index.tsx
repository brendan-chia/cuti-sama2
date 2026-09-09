import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PersonalMenu } from '@/components/personal-menu';
import { BrandLogo } from '@/components/brand-logo';
import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { getLastTripId } from '@/features/trips/service';
import { DestinationRow, malaysiaDestinations, worldDestinations } from '@/features/home/destination-row';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export default function WelcomeScreen() {
  const router = useRouter();
  const [lastTripId, setLastTripId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void getLastTripId().then((tripId) => {
        if (active) setLastTripId(tripId);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <Screen testID="welcome-screen">
      <View style={styles.brandRow}>
        <View style={styles.brandLogo}><BrandLogo /></View>
        <PersonalMenu />
      </View>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>YOUR NEXT GETAWAY STARTS HERE</Text>
        <Text style={styles.title}>Where shall we go?</Text>
        <Text style={styles.subtitle}>
          A weekend close to home or a whole new world. Make it your kind of trip.
        </Text>
      </View>

      <View style={styles.actionPanel}>
        <Text style={styles.sectionTitle}>Create a new trip plan</Text>
        <AppButton label="Start a group trip" onPress={() => router.push('/create')} />
        <AppButton label="Plan a solo adventure" onPress={() => router.push('/solo')} variant="secondary" />
        {lastTripId ? (
          <AppButton
            label="Continue your Trip Room"
            onPress={() => router.push({ pathname: '/trip/[tripId]', params: { tripId: lastTripId } })}
            variant="secondary"
          />
        ) : null}
        <View style={styles.promiseRow}>
          <Text style={styles.promiseIndex}>✈</Text>
          <Text style={styles.promiseText}>No sign-up. Your guest session is created securely in the background.</Text>
        </View>
      </View>
      <View style={styles.inspirationPanel}>
        <Text style={styles.eyebrow}>FROM YOUR FEED TO YOUR NEXT TRIP</Text>
        <Text style={styles.sectionTitle}>Saved it. Forgot it. Travel it.</Text>
        <Text style={styles.inspirationBody}>Paste a reel or travel link and turn it into a place you can actually plan around.</Text>
        <AppButton label="Add travel inspiration" variant="secondary" onPress={() => router.push('/inspiration')} />
      </View>
      <View style={styles.destinationSections}>
        <DestinationRow title="Popular in Malaysia" subtitle="A few favourites, right here at home." destinations={malaysiaDestinations} testID="malaysia-destinations" />
        <DestinationRow title="Popular destinations" subtitle="Dream a little further. Where is next on your list?" destinations={worldDestinations} testID="world-destinations" />
      </View>
      <View style={styles.community}>
        <Text style={styles.sectionTitle}>Find your travel people</Text>
        <AppButton label="Discover public trips" onPress={() => router.push('/discover')} variant="secondary" />
        <AppButton label="Join with an invitation" onPress={() => router.push('/join')} variant="secondary" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  inspirationPanel: { backgroundColor: colors.surfaceTint, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, gap: spacing.md, marginTop: spacing.xl },
  inspirationBody: { color: colors.textMuted, fontSize: typography.body, lineHeight: 24 },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: '800' },
  destinationSections: { gap: 28, marginTop: 28 },
  community: { gap: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.xl, marginTop: spacing.xl },
  brandLogo: { flex: 1, maxWidth: 320 },
  brandRow: { flexDirection: 'row', gap: spacing.lg, justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.paper, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  hero: { justifyContent: 'center', maxWidth: 620, paddingTop: 24, paddingBottom: 24 },
  eyebrow: { color: colors.sky, fontSize: typography.label, fontWeight: '800', letterSpacing: 2, marginBottom: spacing.lg },
  title: { color: colors.ink, fontSize: 34, fontWeight: '900', letterSpacing: -1.8, lineHeight: 40 },
  subtitle: { color: colors.textMuted, fontSize: typography.body, lineHeight: 24, marginTop: spacing.lg, maxWidth: 560 },
  actionPanel: { gap: spacing.md, backgroundColor: colors.surface, padding: 20, borderRadius: 24 },
  promiseRow: {
    alignItems: 'flex-start',
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.lg,
  },
  promiseIndex: { color: colors.gold, fontSize: typography.label, fontWeight: '800', letterSpacing: 1.2 },
  promiseText: { color: colors.textMuted, flex: 1, fontSize: typography.small, lineHeight: 19 },
});
