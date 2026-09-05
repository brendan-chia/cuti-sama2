import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
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
    <Screen testID="welcome-screen">
      <View style={styles.brandRow}>
        <View style={styles.brandMark}><Text style={styles.brandPlane}>✈</Text></View>
        <Text style={styles.wordmark}>CUTISAMA2</Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>GOOD COMPANY. GREAT GETAWAYS.</Text>
        <Text style={styles.title}>The group trip that finally leaves the chat.</Text>
        <Text style={styles.subtitle}>
          Pick the dates. Dream a little. Get your favourite people on the same flight plan.
        </Text>
      </View>

      <View style={styles.postcards} accessibilityLabel="Travel inspiration: Japan and Malaysia">
        <View style={styles.postcard}><Image source={require('../../assets/images/postcard-japan.jpg')} style={styles.postcardImage} contentFit="cover" accessibilityLabel="Japan travel inspiration" /><Text style={styles.postcardCaption}>A little out of office.</Text><Text style={styles.postcardSmall}>JAPAN · WISH YOU WERE HERE</Text></View>
        <View style={styles.miniPostcard}><Image source={require('../../assets/images/postcard-malaysia.jpg')} style={styles.miniImage} contentFit="cover" accessibilityLabel="Malaysia travel inspiration" /><Text style={styles.postcardCaption}>Or closer to home?</Text></View>
        <View style={styles.sunSticker}><Text style={styles.stickerText}>{'BETTER\nTOGETHER'}</Text></View>
      </View>

      <View style={styles.actionPanel}>
        <View style={styles.boardingRow}><Text style={styles.boardingLabel}>BOARDING PASS</Text><Text style={styles.boardingLabel}>1–8 TRAVELLERS</Text></View>
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
          <Text style={styles.promiseIndex}>✈</Text>
          <Text style={styles.promiseText}>No sign-up. Your guest session is created securely in the background.</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  brandMark: { height: 36, width: 36, borderRadius: 12, backgroundColor: colors.sky, alignItems: 'center', justifyContent: 'center' },
  brandPlane: { color: colors.paper, fontSize: 25 },
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
  wordmark: { color: colors.ink, fontSize: typography.small, fontWeight: '900', letterSpacing: 2.2 },
  hero: { justifyContent: 'center', maxWidth: 620, paddingTop: 32, paddingBottom: 24 },
  eyebrow: { color: colors.sky, fontSize: typography.label, fontWeight: '800', letterSpacing: 2, marginBottom: spacing.lg },
  title: { color: colors.ink, fontSize: 39, fontWeight: '900', letterSpacing: -1.8, lineHeight: 43 },
  subtitle: { color: colors.textMuted, fontSize: typography.body, lineHeight: 24, marginTop: spacing.lg, maxWidth: 560 },
  postcards: { height: 208, marginBottom: 24, marginHorizontal: 10 },
  postcard: { width: '64%', maxWidth: 290, backgroundColor: colors.paper, padding: 8, paddingBottom: 12, borderRadius: 5, transform: [{ rotate: '-5deg' }] },
  postcardImage: { height: 125, borderRadius: 3 }, postcardCaption: { color: colors.ink, fontSize: 13, fontWeight: '800', marginTop: 9, marginHorizontal: 4 }, postcardSmall: { color: colors.textMuted, fontSize: 8, letterSpacing: 1.2, marginTop: 5, marginHorizontal: 4 },
  miniPostcard: { position: 'absolute', right: 0, top: 45, width: '48%', backgroundColor: colors.paper, padding: 7, paddingBottom: 12, borderRadius: 5, transform: [{ rotate: '7deg' }] }, miniImage: { height: 100, borderRadius: 3 },
  sunSticker: { position: 'absolute', top: -7, right: 4, backgroundColor: colors.sun, width: 73, height: 73, borderRadius: 37, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '12deg' }] }, stickerText: { color: colors.ink, textAlign: 'center', fontSize: 10, lineHeight: 15, fontWeight: '900', letterSpacing: 0.6 },
  boardingRow: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 14, borderBottomWidth: 1, borderStyle: 'dashed', borderColor: colors.border, marginBottom: 3 }, boardingLabel: { fontSize: 9, color: colors.textMuted, letterSpacing: 1.3, fontWeight: '800' },
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
