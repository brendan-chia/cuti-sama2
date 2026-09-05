import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export function CustomMustHaveSheet({ visible, initialValue, onCancel, onCreate }: { visible: boolean; initialValue: string; onCancel: () => void; onCreate: (value: string) => void }) {
  const [value, setValue] = useState(initialValue); const [error, setError] = useState<string | null>(null);
  function create() { const clean = value.trim(); if (!clean) { setError('Enter one specific experience.'); return; } onCreate(clean); }
  return <Modal animationType="slide" onRequestClose={onCancel} transparent visible={visible}>
    <View style={styles.scrim}><View accessibilityViewIsModal style={styles.sheet}>
      <View style={styles.handle} /><Text style={styles.kicker}>CUSTOM MUST-HAVE</Text><Text style={styles.title}>What would make the trip worthwhile?</Text>
      <Text style={styles.body}>Enter one specific experience. This won’t change dates, budgets or other hard constraints.</Text>
      <TextInput accessibilityLabel="Custom Must-Have" autoFocus maxLength={60} onChangeText={(text) => { setValue(text); setError(null); }} placeholder="e.g. See the cherry blossoms" placeholderTextColor={colors.disabled} selectionColor={colors.coral} style={styles.input} value={value} />
      <Text style={styles.count}>{value.length} / 60</Text>{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}><AppButton label="Create & play card" onPress={create} testID="create-custom-card" /><Pressable accessibilityRole="button" onPress={onCancel} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable></View>
    </View></View>
  </Modal>;
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: colors.overlay, flex: 1, justifyContent: 'flex-end' }, sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl, paddingBottom: spacing.xxl },
  handle: { alignSelf: 'center', backgroundColor: colors.border, borderRadius: radius.pill, height: 4, marginBottom: spacing.xl, width: 42 }, kicker: { color: colors.sky, fontSize: typography.label, fontWeight: '900', letterSpacing: 1.3 },
  title: { color: colors.ink, fontSize: typography.heading, fontWeight: '900', marginTop: spacing.sm }, body: { color: colors.textMuted, fontSize: typography.small, lineHeight: 20, marginTop: spacing.sm },
  input: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, color: colors.ink, fontSize: typography.body, marginTop: spacing.xl, minHeight: 54, paddingHorizontal: spacing.lg }, count: { color: colors.textMuted, fontSize: typography.label, marginTop: spacing.sm, textAlign: 'right' },
  error: { color: colors.danger, fontSize: typography.small, marginTop: spacing.sm }, actions: { gap: spacing.md, marginTop: spacing.lg }, cancel: { alignItems: 'center', justifyContent: 'center', minHeight: 44 }, cancelText: { color: colors.textMuted, fontSize: typography.body, fontWeight: '700' },
});
