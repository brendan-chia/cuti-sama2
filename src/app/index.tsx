import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BrandLogo } from '@/components/brand-logo';
import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { getLastTripId } from '@/features/trips/service';
import { DestinationRow, malaysiaDestinations, worldDestinations } from '@/features/home/destination-row';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export default function WelcomeScreen() {
  const router = useRouter();
  const [contentWidth, setContentWidth] = useState(0);
  const wide = contentWidth >= 620;
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
      </View>

      <View style={[styles.introLayout, wide && styles.introWide]} onLayout={event => setContentWidth(event.nativeEvent.layout.width)}>
      <View style={[styles.hero, wide && styles.introColumn]}>
        <Text style={styles.eyebrow}>YOUR NEXT GETAWAY STARTS HERE</Text>
        <Text accessibilityRole="header" style={[styles.title, wide && styles.titleWide]}>Where shall we go?</Text>
        <Text style={styles.subtitle}>
          A weekend close to home or a whole new world. Make it your kind of trip.
        </Text>
      </View>

      <View style={[styles.actionPanel, wide && styles.introColumn]}>
        <Text style={styles.sectionTitle}>A good trip starts with a plan.</Text>
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
          <Text style={styles.promiseText}>Start as a guest. Bring your people when you’re ready.</Text>
        </View>
      </View>
      </View>
      <View style={styles.inspirationPanel}>
        <Text style={styles.eyebrow}>FROM YOUR FEED TO YOUR NEXT TRIP</Text>
        <Text style={styles.sectionTitle}>Saved it. Forgot it. Travel it.</Text>
        <Text style={styles.inspirationBody}>Paste a reel or travel link and turn it into a place you can actually plan around.</Text>
        <AppButton label="Add travel inspiration" variant="secondary" onPress={() => router.push('/inspiration')} />
      </View>
      <View style={styles.destinationSections}>
        <View style={styles.destinationSection}>
          <DestinationRow title="Popular in Malaysia" subtitle="A few favourites, right here at home." destinations={malaysiaDestinations} testID="malaysia-destinations" />
        </View>
        <View style={styles.destinationSection}>
          <DestinationRow title="Popular destinations" subtitle="Dream a little further. Where is next on your list?" destinations={worldDestinations} testID="world-destinations" />
        </View>
      </View>

    </Screen>
  );
}

const styles = StyleSheet.create({
  introLayout: { gap: spacing.lg, paddingTop: spacing.xl },
  introWide: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  introColumn: { flex: 1 },
  titleWide: { fontSize: 38, lineHeight: 44 },
  inspirationPanel: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, gap: spacing.md, marginTop: spacing.xl },
  inspirationBody: { color: colors.textMuted, fontSize: typography.body, lineHeight: 24 },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: '800' },
  destinationSections: { gap: 28, marginTop: 28 },
  destinationSection: { borderRadius: radius.lg, padding: spacing.lg },
  brandLogo: { flex: 1, maxWidth: 240 },
  brandRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  hero: { justifyContent: 'center', paddingBottom: spacing.sm },
  eyebrow: { color: colors.sky, fontSize: typography.label, fontWeight: '800', letterSpacing: 0.8, marginBottom: spacing.md },
  title: { color: colors.ink, fontSize: 32, fontWeight: '700', letterSpacing: -0.8, lineHeight: 38 },
  subtitle: { color: colors.textMuted, fontSize: typography.body, lineHeight: 24, marginTop: spacing.lg, maxWidth: 560 },
  actionPanel: { borderWidth: 1, borderColor: colors.border, gap: spacing.md, backgroundColor: colors.surfaceTint, padding: spacing.lg, borderRadius: radius.md },
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
