import type { PropsWithChildren, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme/tokens';

type ScreenProps = PropsWithChildren<{
  footer?: ReactNode;
  scroll?: boolean;
  testID?: string;
  contentStyle?: StyleProp<ViewStyle>;
}>;

export function Screen({ children, contentStyle, footer, scroll = true, testID }: ScreenProps) {
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      testID={testID}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, contentStyle]} testID={testID}>
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.maxWidth}>
          {content}
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.midnight,
  },
  keyboardView: {
    flex: 1,
  },
  maxWidth: {
    alignSelf: 'center',
    flex: 1,
    maxWidth: 560,
    width: '100%',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  footer: {
    backgroundColor: colors.midnight,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
});
