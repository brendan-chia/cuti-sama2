import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { getLastTripId } from '@/features/trips/service';
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
    <Screen scroll={false} testID="welcome-screen">
      <View style={styles.brandRow}>
        <View style={styles.brandMark}>
          <View style={styles.brandDot} />
          <View style={[styles.brandDot, styles.brandDotSecond]} />
        </View>
        <Text style={styles.wordmark}>CUTISAMA2</Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>PLAN TOGETHER. GO FURTHER.</Text>
        <Text style={styles.title}>The group trip that finally leaves the chat.</Text>
        <Text style={styles.subtitle}>
          Find your dates. Play your dream destinations. Swipe, explore, and build a budget together—five little chapters to your next escape.
        </Text>
      </View>

      <View style={styles.actionPanel}>
        <AppButton label="Start a group trip" onPress={() => router.push('/create')} />
        <AppButton label="Join with an invitation" onPress={() => router.push('/join')} variant="secondary" />
        {lastTripId ? (
          <AppButton
            label="Continue your Trip Room"
            onPress={() => router.push({ pathname: '/trip/[tripId]', params: { tripId: lastTripId } })}
            variant="secondary"
          />
        ) : null}
        <View style={styles.promiseRow}>
          <Text style={styles.promiseIndex}>01</Text>
          <Text style={styles.promiseText}>No sign-up. Your guest session is created securely in the background.</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  brandMark: { height: 24, position: 'relative', width: 36 },
  brandDot: {
    backgroundColor: colors.coral,
    borderRadius: radius.pill,
    height: 22,
    left: 0,
    position: 'absolute',
    top: 0,
    width: 22,
  },
  brandDotSecond: { backgroundColor: colors.sky, left: 14, opacity: 0.82 },
  wordmark: { color: colors.white, fontSize: typography.small, fontWeight: '900', letterSpacing: 2.2 },
  hero: { flex: 1, justifyContent: 'center', maxWidth: 620, paddingVertical: spacing.xxl },
  eyebrow: { color: colors.sky, fontSize: typography.label, fontWeight: '800', letterSpacing: 2, marginBottom: spacing.lg },
  title: { color: colors.white, fontSize: typography.display, fontWeight: '900', letterSpacing: -1.8, lineHeight: 46 },
  subtitle: { color: colors.textMuted, fontSize: typography.body, lineHeight: 25, marginTop: spacing.xl, maxWidth: 560 },
  actionPanel: { gap: spacing.md },
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
