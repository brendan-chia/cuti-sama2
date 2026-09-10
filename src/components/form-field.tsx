import { useId, useState, type ComponentProps } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme/tokens';

type FormFieldProps = ComponentProps<typeof TextInput> & {
  label: string;
  hint?: string;
  error?: string;
};

export function FormField({ label, hint, error, style, ...inputProps }: FormFieldProps) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.coral}
        accessibilityHint={[hint, error].filter(Boolean).join('. ')}
        aria-describedby={error ? `${id}-error` : undefined}
        style={[styles.input, focused ? styles.focused : null, inputProps.multiline ? styles.multiline : null, error ? styles.inputError : null, style]}
        {...inputProps}
        onFocus={(event) => { setFocused(true); inputProps.onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); inputProps.onBlur?.(event); }}
      />
      {error ? (
        <Text nativeID={`${id}-error`} accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.sm,
  },
  label: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '700',
  },
  hint: {
    color: colors.textMuted,
    fontSize: typography.small,
    lineHeight: 19,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: typography.body,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  multiline: {
    minHeight: 108,
    textAlignVertical: 'top',
  },
  focused: { borderColor: colors.sky, borderWidth: 2 },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    color: colors.danger,
    fontSize: typography.small,
    lineHeight: 18,
  },
});
