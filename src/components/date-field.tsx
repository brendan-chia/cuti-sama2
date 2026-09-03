import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { FormField } from '@/components/form-field';
import { colors, radius, spacing, typography } from '@/theme/tokens';

type DateFieldProps = {
  error?: string;
  label: string;
  minimumDate?: string;
  onChange: (value: string) => void;
  value: string;
};

function dateFromValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
}

function dateOnly(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function displayDate(value: string) {
  return dateFromValue(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function DateField({ error, label, minimumDate, onChange, value }: DateFieldProps) {
  const [showPicker, setShowPicker] = useState(false);

  // @expo/ui's native calendar does not render on web, so retain a typed
  // fallback there. Android and iOS users always get the platform picker.
  if (Platform.OS === 'web') {
    return (
      <FormField
        autoCapitalize="none"
        error={error}
        hint="Optional — use YYYY-MM-DD"
        keyboardType="numbers-and-punctuation"
        label={label}
        maxLength={10}
        onChangeText={onChange}
        placeholder="2026-12-05"
        value={value}
      />
    );
  }

  const pickerValue = value ? dateFromValue(value) : minimumDate ? dateFromValue(minimumDate) : new Date();

  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.hint}>Optional — choose from the calendar</Text>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        onPress={() => setShowPicker(true)}
        style={({ pressed }) => [
          styles.input,
          error ? styles.inputError : null,
          pressed ? styles.pressed : null,
        ]}
      >
        <Text style={value ? styles.value : styles.placeholder}>
          {value ? displayDate(value) : 'Choose date'}
        </Text>
        <Text aria-hidden style={styles.calendar}>CAL</Text>
      </Pressable>
      {value ? (
        <Pressable accessibilityRole="button" onPress={() => onChange('')} style={styles.clearButton}>
          <Text style={styles.clearText}>Clear date</Text>
        </Pressable>
      ) : null}
      {showPicker ? (
        <DateTimePicker
          accentColor={colors.coral}
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={minimumDate ? dateFromValue(minimumDate) : undefined}
          mode="date"
          onDismiss={() => setShowPicker(false)}
          onValueChange={(_event, selectedDate) => {
            onChange(dateOnly(selectedDate));
            setShowPicker(false);
          }}
          presentation="dialog"
          testID={`${label.toLowerCase().replace(/\s+/g, '-')}-picker`}
          themeVariant="dark"
          value={pickerValue}
        />
      ) : null}
      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  label: { color: colors.white, fontSize: typography.body, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: typography.small, lineHeight: 19 },
  input: {
    alignItems: 'center',
    backgroundColor: colors.midnightRaised,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  inputError: { borderColor: colors.danger },
  pressed: { opacity: 0.82 },
  value: { color: colors.white, fontSize: typography.body },
  placeholder: { color: colors.disabled, fontSize: typography.body },
  calendar: { color: colors.sky, fontSize: typography.label, fontWeight: '800', letterSpacing: 1.1 },
  clearButton: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
  clearText: { color: colors.sky, fontSize: typography.small, fontWeight: '700' },
  error: { color: colors.danger, fontSize: typography.small, lineHeight: 18 },
});
