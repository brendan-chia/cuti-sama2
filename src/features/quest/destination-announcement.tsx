import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/app-button';
import { colors, radius, spacing } from '@/theme/tokens';
import { countryByCode } from '../../../packages/contracts/src/countries';

export function DestinationAnnouncement({ countryCode, onDismiss }: { countryCode: string | null; onDismiss: () => void }) {
  const country = countryByCode(countryCode);
  if (!country) return null;
  return <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
    <SafeAreaView style={styles.backdrop}>
      <ScrollView contentContainerStyle={styles.container}>
        <View accessibilityViewIsModal style={styles.panel} testID="destination-announcement">
          <Text style={styles.eyebrow}>DESTINATION DECIDED</Text>
          <Text accessibilityRole="header" style={styles.title}>You’re going to {country.name}.</Text>
          <Text style={styles.body}>Your next trip has a destination. Explore the map and choose the places you’d love to visit together.</Text>
          <AppButton label={`Explore ${country.name}`} onPress={onDismiss} testID="dismiss-destination-announcement" />
        </View>
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.scrim },
  container: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  panel: { width: '100%', maxWidth: 440, backgroundColor: colors.surfaceTint, borderWidth: 1, borderColor: colors.leafSurface, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.lg },
  eyebrow: { color: colors.sky, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 30, lineHeight: 38, fontWeight: '800', letterSpacing: -0.5 },
  body: { color: colors.textMuted, fontSize: 16, lineHeight: 25 },
});
