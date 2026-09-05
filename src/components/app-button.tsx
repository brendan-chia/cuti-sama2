import type { ReactNode } from 'react';
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

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' ? styles.primary : styles.secondary,
        pressed && !inactive ? styles.pressed : null,
        inactive ? styles.disabled : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.paper : colors.ink} />
      ) : (
        <View style={styles.labelRow}>
          {leading}
          <Text style={[styles.label, variant === 'primary' ? styles.primaryLabel : null]}>
            {label}
          </Text>
        </View>
      )}
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
  },
  primary: {
    backgroundColor: colors.sky,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.48,
  },
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
  },
  primaryLabel: {
    color: colors.paper,
    fontWeight: '800',
  },
});
