import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme/tokens';

type AppButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
  leading?: ReactNode;
  testID?: string;
};

export function AppButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  leading,
  testID,
}: AppButtonProps) {
  const inactive = disabled || loading;
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-disabled={inactive} aria-busy={loading} accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' ? styles.primary : styles.secondary,
        pressed && !inactive ? [styles.pressed, variant === 'primary' && styles.primaryPressed] : null,
        disabled && !loading ? styles.disabled : null,
        focused && !inactive ? styles.focused : null,
      ]}
    >
      <View style={styles.labelRow}>
          {loading ? <ActivityIndicator color={variant === 'primary' ? colors.paper : colors.ink} /> : leading}
          <Text style={[styles.label, variant === 'primary' ? styles.primaryLabel : null, disabled && !loading && styles.disabledLabel]}>
            {label}
          </Text>
        </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: radius.md,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  primary: {
    backgroundColor: colors.sky,
    borderColor: colors.sky,
    borderWidth: 1,
  },
  secondary: {
    backgroundColor: colors.paper,
    borderColor: colors.border,
    borderWidth: 1,
  },
  pressed: {
    opacity: 1,
  },
  primaryPressed: { backgroundColor: colors.ink },
  disabled: {
    backgroundColor: colors.border,
    borderColor: colors.border,
  },
  focused: { borderColor: colors.ink, borderWidth: 2 },
  disabledLabel: { color: colors.textMuted },
  labelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  label: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '700',
    letterSpacing: 0.1,
    textAlign: 'center',
    flexShrink: 1,
  },
  primaryLabel: {
    color: colors.paper,
    fontWeight: '800',
  },
});
