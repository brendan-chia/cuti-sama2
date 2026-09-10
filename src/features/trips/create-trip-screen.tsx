import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { TripSummary } from '../../../packages/contracts/src/trip';
import { AppButton } from '@/components/app-button';
import { FormField } from '@/components/form-field';
import { Screen } from '@/components/screen';
import { createTrip } from '@/features/trips/service';
import { buildCreateTripRequest, initialCreateTripForm, readableValidationError } from '@/features/trips/validation';
import { isSupabaseConfigured } from '@/lib/supabase';
import { recoveryKind, recoveryMessage } from '@/features/recovery/errors';
import { colors, radius, spacing } from '@/theme/tokens';

type Props = { onCreated: (trip: TripSummary) => void; createTripAction?: typeof createTrip; configured?: boolean };
export function CreateTripScreen({ onCreated, createTripAction = createTrip, configured = isSupabaseConfigured }: Props) {
  const [tripName, setTripName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  async function submit() {
    if (inFlight.current) return;
    const result = buildCreateTripRequest({ ...initialCreateTripForm, mode: 'undecided', tripName });
    if (!result.success) { setError(result.errors.tripName ?? result.errors.form ?? 'Give your trip a name.'); return; }
    inFlight.current = true; setSubmitting(true); setError(null);
    try { onCreated(await createTripAction(result.data)); }
    catch (cause) { const kind = recoveryKind(cause); setError(kind === 'unknown' ? readableValidationError(cause) : recoveryMessage(kind)); }
    finally { inFlight.current = false; setSubmitting(false); }
  }
  return <Screen testID="create-trip-screen" footer={<AppButton label="Create trip" testID="create-trip-submit" disabled={!configured} loading={submitting} onPress={() => void submit()} />}>
    <View style={styles.stack}>
      <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 28, lineHeight: 34, fontWeight: '700' }}>Start a group trip</Text>
      <Text style={styles.body}>Give your plan a name. Dates, places and people can come next.</Text>
      {!configured ? <View accessibilityRole="alert" style={styles.notice}><Text style={styles.heading}>Trip rooms are unavailable</Text><Text style={styles.body}>The planning service isn’t connected yet. Please try again once it’s available.</Text></View> : null}
      <FormField label="Trip name" autoCapitalize="words" maxLength={80} placeholder="e.g. The annual escape" value={tripName} onChangeText={(value) => { setTripName(value); setError(null); }} />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Text style={styles.body}>Invite up to 8 travellers, including you. Everyone can contribute to the shared plan.</Text>
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  stack: { gap: spacing.xl }, body: { color: colors.textMuted, fontSize: 15, lineHeight: 24 }, heading: { color: colors.ink, fontSize: 15, fontWeight: '800' }, small: { color: colors.textMuted, fontSize: 12, lineHeight: 19 }, notice: { backgroundColor: colors.surface, padding: spacing.lg, borderRadius: radius.md, gap: spacing.sm }, error: { color: colors.danger, lineHeight: 20 }, chapters: { gap: spacing.xl }, chapter: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center' }, number: { height: 38, width: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.surfaceTint }, numberText: { color: colors.sky, fontWeight: '800', fontSize: 12 }, chapterCopy: { flex: 1, gap: spacing.xs },
});
