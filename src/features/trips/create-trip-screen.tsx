import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { PlanningMode, TripSummary } from '../../../packages/contracts/src/trip';
import { AppButton } from '@/components/app-button';
import { FormField } from '@/components/form-field';
import { Screen } from '@/components/screen';
import { ModeCard } from '@/features/trips/mode-card';
import { planningModeOptions } from '@/features/trips/planning-modes';
import { createTrip } from '@/features/trips/service';
import {
  buildCreateTripRequest,
  initialCreateTripForm,
  readableValidationError,
  type CreateTripErrors,
  type CreateTripFormValues,
} from '@/features/trips/validation';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors, radius, spacing, typography } from '@/theme/tokens';

type CreateTripScreenProps = {
  onCreated: (trip: TripSummary) => void;
  createTripAction?: typeof createTrip;
  configured?: boolean;
};

export function CreateTripScreen({
  onCreated,
  createTripAction = createTrip,
  configured = isSupabaseConfigured,
}: CreateTripScreenProps) {
  const [values, setValues] = useState<CreateTripFormValues>(initialCreateTripForm);
  const [errors, setErrors] = useState<CreateTripErrors>({});
  const [submitting, setSubmitting] = useState(false);

  function update<Field extends keyof CreateTripFormValues>(
    field: Field,
    value: CreateTripFormValues[Field],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
  }

  function selectMode(mode: PlanningMode) {
    update('mode', mode);
    setErrors({});
  }

  async function submit() {
    const result = buildCreateTripRequest(values);
    if (!result.success) {
      setErrors(result.errors);
      return;
    }

    setSubmitting(true);
    setErrors({});
    try {
      const trip = await createTripAction(result.data);
      onCreated(trip);
    } catch (error) {
      setErrors({ form: readableValidationError(error) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen
      footer={
        <AppButton
          disabled={!configured}
          label="Create our Trip Room"
          loading={submitting}
          onPress={submit}
          testID="create-trip-submit"
        />
      }
      testID="create-trip-screen"
    >
      <View style={styles.progressRow}>
        <Text style={styles.progressLabel}>TRIP SETUP</Text>
        <Text style={styles.progressValue}>1 OF 3</Text>
      </View>
      <Text style={styles.title}>What kind of trip are you planning?</Text>
      <Text style={styles.intro}>
        Start with what the group already knows. You can change this before preference collection begins.
      </Text>

      {!configured ? (
        <View accessibilityRole="alert" style={styles.notice}>
          <Text style={styles.noticeTitle}>Connect Supabase to create a room</Text>
          <Text style={styles.noticeBody}>
            Copy .env.example to .env and add your project URL and publishable key.
          </Text>
        </View>
      ) : null}

      <View accessibilityRole="radiogroup" style={styles.modeList}>
        {planningModeOptions.map((option) => (
          <ModeCard
            key={option.value}
            onSelect={selectMode}
            option={option}
            selected={values.mode === option.value}
          />
        ))}
      </View>

      <View style={styles.divider} />
      <View style={styles.formSection}>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionKicker}>THE BASICS</Text>
          <Text style={styles.sectionTitle}>Name the plan</Text>
        </View>
        <FormField
          autoCapitalize="words"
          error={errors.tripName}
          label="Trip name"
          maxLength={80}
          onChangeText={(value) => update('tripName', value)}
          placeholder="e.g. Langkawi long weekend"
          returnKeyType="next"
          value={values.tripName}
        />

        {values.mode === 'destination_locked' ? (
          <FormField
            autoCapitalize="words"
            error={errors.lockedDestination}
            hint="Worldwide destinations are welcome. Data confidence is handled in a later step."
            label="Destination"
            maxLength={120}
            onChangeText={(value) => update('lockedDestination', value)}
            placeholder="e.g. Langkawi, Malaysia"
            value={values.lockedDestination}
          />
        ) : null}

        {values.mode === 'shortlist' ? (
          <FormField
            autoCapitalize="words"
            error={errors.shortlist}
            hint="Enter one destination per line, from two to five places."
            label="Destination shortlist"
            multiline
            onChangeText={(value) => update('shortlist', value)}
            placeholder={'Bangkok, Thailand\nDa Nang, Vietnam'}
            value={values.shortlist}
          />
        ) : null}

        {values.mode === 'undecided' ? (
          <View style={styles.discoveryNote}>
            <Text style={styles.discoveryLabel}>NO DESTINATION NEEDED YET</Text>
            <Text style={styles.discoveryText}>
              The group will add origins, dates, budgets, and travel constraints before discovery begins.
            </Text>
          </View>
        ) : null}

        <View style={styles.dateGroup}>
          <FormField
            autoCapitalize="none"
            error={errors.startsOn}
            hint="Optional — use YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
            label="Start date"
            maxLength={10}
            onChangeText={(value) => update('startsOn', value)}
            placeholder="2026-12-05"
            value={values.startsOn}
          />
          <FormField
            autoCapitalize="none"
            error={errors.endsOn}
            hint="Optional — use YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
            label="End date"
            maxLength={10}
            onChangeText={(value) => update('endsOn', value)}
            placeholder="2026-12-08"
            value={values.endsOn}
          />
        </View>

        {errors.form ? (
          <Text accessibilityLiveRegion="assertive" style={styles.formError}>
            {errors.form}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg },
  progressLabel: { color: colors.sky, fontSize: typography.label, fontWeight: '800', letterSpacing: 1.8 },
  progressValue: { color: colors.textMuted, fontSize: typography.label, fontWeight: '700' },
  title: { color: colors.white, fontSize: typography.title, fontWeight: '800', letterSpacing: -0.7, lineHeight: 34, maxWidth: 520 },
  intro: { color: colors.textMuted, fontSize: typography.body, lineHeight: 24, marginTop: spacing.md, maxWidth: 570 },
  notice: { backgroundColor: colors.midnightRaised, borderColor: colors.sky, borderLeftWidth: 3, borderRadius: radius.md, gap: spacing.xs, marginTop: spacing.xl, padding: spacing.lg },
  noticeTitle: { color: colors.white, fontSize: typography.body, fontWeight: '700' },
  noticeBody: { color: colors.textMuted, fontSize: typography.small, lineHeight: 19 },
  modeList: { gap: spacing.md, marginTop: spacing.xl },
  divider: { backgroundColor: colors.border, height: StyleSheet.hairlineWidth, marginVertical: spacing.xxl },
  formSection: { gap: spacing.xl },
  sectionHeading: { gap: spacing.xs },
  sectionKicker: { color: colors.coral, fontSize: typography.label, fontWeight: '800', letterSpacing: 1.5 },
  sectionTitle: { color: colors.white, fontSize: typography.heading, fontWeight: '800' },
  discoveryNote: { backgroundColor: colors.midnightRaised, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, gap: spacing.sm, padding: spacing.lg },
  discoveryLabel: { color: colors.gold, fontSize: typography.label, fontWeight: '800', letterSpacing: 1.2 },
  discoveryText: { color: colors.textMuted, fontSize: typography.small, lineHeight: 20 },
  dateGroup: { gap: spacing.lg },
  formError: { backgroundColor: colors.midnightRaised, borderRadius: radius.sm, color: colors.danger, fontSize: typography.small, lineHeight: 19, padding: spacing.md },
});
