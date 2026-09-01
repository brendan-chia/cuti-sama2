import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { InviteContext } from '../../../packages/contracts/src/invite';
import { AppButton } from '@/components/app-button';
import { FormField } from '@/components/form-field';
import { Screen } from '@/components/screen';
import { joinTrip, resolveInvitation } from '@/features/invites/service';
import { colors, radius, spacing, typography } from '@/theme/tokens';

type Props = { token: string; onJoined: (tripId: string) => void; resolveAction?: typeof resolveInvitation; joinAction?: typeof joinTrip };

export function JoinTripScreen({ token, onJoined, resolveAction = resolveInvitation, joinAction = joinTrip }: Props) {
  const [context, setContext] = useState<InviteContext | null>(null);
  const [name, setName] = useState('');
  const [duplicate, setDuplicate] = useState<{ displayName: string; discriminator: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let active = true;
    void resolveAction(token).then((value) => active && setContext(value)).catch(() => active && setError('This invitation is unavailable. Ask the organiser for a new link.')).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [resolveAction, token]);

  async function submit(confirmDuplicate: boolean) {
    if (!name.trim()) { setError('Enter a display name.'); return; }
    setJoining(true); setError(null);
    try {
      const result = await joinAction(token, name, confirmDuplicate);
      if (result.status === 'confirmation_required') setDuplicate(result);
      else onJoined(result.tripId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not join the Trip Room.'); }
    finally { setJoining(false); }
  }

  if (loading) return <Screen scroll={false}><View style={styles.center}><Text style={styles.body}>Checking invitation…</Text></View></Screen>;
  if (!context) return <Screen scroll={false}><View accessibilityRole="alert" style={styles.center}><Text style={styles.title}>Link unavailable</Text><Text style={styles.body}>{error}</Text></View></Screen>;

  return <Screen testID="join-trip-screen">
    <Text style={styles.kicker}>YOU’RE INVITED</Text>
    <Text style={styles.title}>{context.tripName}</Text>
    <Text style={styles.body}>{context.organizerName} invited you to plan this trip together.</Text>
    <View style={styles.panel}>
      <FormField autoCapitalize="words" editable={!duplicate} label="Your display name" maxLength={50} onChangeText={(value) => { setName(value); setDuplicate(null); setError(null); }} placeholder="e.g. Aina" value={name} />
      {duplicate ? <View style={styles.duplicate}>
        <Text style={styles.panelTitle}>Another {duplicate.displayName} is already here</Text>
        <Text style={styles.body}>You’ll appear as {duplicate.displayName} · {duplicate.discriminator} so the group can tell you apart.</Text>
        <AppButton label={`Continue as ${duplicate.displayName} · ${duplicate.discriminator}`} loading={joining} onPress={() => void submit(true)} />
        <AppButton label="Use a different name" variant="secondary" onPress={() => setDuplicate(null)} />
      </View> : <AppButton label="Join Trip Room" loading={joining} onPress={() => void submit(false)} testID="join-trip-submit" />}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
    <Text style={styles.privacy}>The link reveals only this invitation preview until you join.</Text>
  </Screen>;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, gap: spacing.md, justifyContent: 'center' },
  kicker: { color: colors.coral, fontSize: typography.label, fontWeight: '800', letterSpacing: 1.7 },
  title: { color: colors.white, fontSize: typography.title, fontWeight: '900', lineHeight: 35, marginTop: spacing.md, textAlign: 'center' },
  body: { color: colors.textMuted, fontSize: typography.body, lineHeight: 23, marginTop: spacing.sm, textAlign: 'center' },
  panel: { backgroundColor: colors.midnightRaised, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, gap: spacing.lg, marginTop: spacing.xxl, padding: spacing.xl },
  panelTitle: { color: colors.white, fontSize: typography.heading, fontWeight: '800', textAlign: 'center' },
  duplicate: { gap: spacing.md },
  error: { color: colors.danger, fontSize: typography.small, lineHeight: 19, textAlign: 'center' },
  privacy: { color: colors.textMuted, fontSize: typography.small, lineHeight: 19, marginTop: spacing.xl, textAlign: 'center' },
});
