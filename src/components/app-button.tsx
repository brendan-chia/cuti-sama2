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
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' ? styles.primary : styles.secondary,
        pressed && !inactive ? [styles.pressed, variant === 'primary' && styles.primaryPressed] : null,
        inactive ? styles.disabled : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.onAction : colors.ink} />
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
    paddingVertical: spacing.md,
  },
  primary: {
    backgroundColor: colors.action,
    borderColor: colors.sky,
    borderWidth: 1,
  },
  secondary: {
    backgroundColor: colors.surfaceTint,
    borderColor: colors.border,
    borderWidth: 1,
  },
  pressed: {
    opacity: 1,
    transform: [{ scale: 0.99 }],
  },
  primaryPressed: { backgroundColor: colors.actionPressed },
  disabled: {
    opacity: 0.65,
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
    textAlign: 'center',
    flexShrink: 1,
  },
  primaryLabel: {
    color: colors.onAction,
    fontWeight: '800',
  },
});
