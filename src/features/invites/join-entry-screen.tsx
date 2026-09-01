import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/app-button';
import { FormField } from '@/components/form-field';
import { Screen } from '@/components/screen';
import { extractInviteToken } from '@/features/invites/validation';
import { colors, spacing, typography } from '@/theme/tokens';

export function JoinEntryScreen({ onToken }: { onToken: (token: string) => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | undefined>();
  function submit() { const token = extractInviteToken(value); if (!token) setError('Paste a valid CutiSama2 invitation link.'); else onToken(token); }
  return <Screen footer={<AppButton label="Open invitation" onPress={submit} />} testID="join-entry-screen">
    <Text style={styles.kicker}>JOIN A TRIP</Text><Text style={styles.title}>Bring the invitation link.</Text><Text style={styles.body}>Open a link directly, scan its QR code, or paste it below.</Text>
    <View style={styles.form}><FormField autoCapitalize="none" autoCorrect={false} error={error} label="Invitation link" onChangeText={(text) => { setValue(text); setError(undefined); }} placeholder="https://…/invite/…" value={value} /></View>
  </Screen>;
}
const styles = StyleSheet.create({ kicker: { color: colors.sky, fontSize: typography.label, fontWeight: '800', letterSpacing: 1.7 }, title: { color: colors.white, fontSize: typography.title, fontWeight: '900', lineHeight: 35, marginTop: spacing.md }, body: { color: colors.textMuted, fontSize: typography.body, lineHeight: 23, marginTop: spacing.sm }, form: { marginTop: spacing.xxl } });
