import type { PropsWithChildren, ReactNode, Ref } from 'react';
import { usePathname } from 'expo-router';
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
  scrollRef?: Ref<ScrollView>;
  contentStyle?: StyleProp<ViewStyle>;
}>;

export function Screen({ children, contentStyle, footer, scroll = true, testID, scrollRef }: ScreenProps) {
  const pathname = usePathname?.() ?? '';
  const ownsTop = ['/', '/trips', '/inspiration', '/profile'].includes(pathname) || pathname.endsWith('/quest') || pathname.includes('/itinerary');
  const content = scroll ? (
    <ScrollView
      ref={scrollRef}
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
    <SafeAreaView edges={ownsTop ? ['top', 'left', 'right'] : ['left', 'right']} style={styles.safeArea}>
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
  cloud: { position: 'absolute', right: -70, top: 90, width: 220, height: 80, borderRadius: 80, backgroundColor: colors.paper, opacity: 0.35, transform: [{ rotate: '-18deg' }] },
  safeArea: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.background,
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
    backgroundColor: colors.background,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
});
