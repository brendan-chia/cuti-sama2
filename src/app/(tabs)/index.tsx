import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BrandLogo } from '@/components/brand-logo';
import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { loadMyTrips, type MyTrip } from '@/features/profile/service';
import { DestinationRow, malaysiaDestinations, worldDestinations } from '@/features/home/destination-row';
import { colors, spacing } from '@/theme/tokens';

export default function WelcomeScreen() {
  const router = useRouter();
  const [recent, setRecent] = useState<MyTrip | null>(null);
  useFocusEffect(useCallback(() => {
    let active = true;
    void loadMyTrips().then(({ trips, completed }) => {
      if (active) setRecent(trips.find(trip => !completed.has(trip.id)) ?? null);
    }).catch(() => { if (active) setRecent(null); });
    return () => { active = false; };
  }, []));
  return <Screen testID="welcome-screen">
    <View style={s.brand}><BrandLogo compact /><Text style={s.brandNote}>A little planning. More possibilities.</Text></View>
    <View style={s.hero}>
      <Text accessibilityRole="header" style={s.title}>{recent ? 'Let’s get your trip together.' : 'Plan a trip, together.'}</Text>
      <Text style={s.body}>Bring your ideas, find what works for everyone, and make a plan worth looking forward to.</Text>
    </View>
    {recent ? <View style={s.resume}>
      <Text style={s.caption}>Continue planning</Text>
      <Text style={s.heading}>{recent.name}</Text>
      <Text style={s.body}>{recent.travel_party === 'solo' ? 'Solo trip' : 'Group trip'} · {recent.planning_started_at ? 'Planning in progress' : 'Draft'}</Text>
      <AppButton label="Open trip" onPress={() => router.push({ pathname: '/trip/[tripId]', params: { tripId: recent.id } })} />
    </View> : null}
    <View style={s.actions}>
      <AppButton label="Create a trip" variant={recent ? 'secondary' : 'primary'} onPress={() => router.push('/new-trip')} />
      <Pressable accessibilityRole="button" onPress={() => router.push('/join')} style={s.link}><Text style={s.linkText}>Have an invitation? Join a trip →</Text></Pressable>
      {!recent ? <Text style={s.note}>Solo or with friends. Start without signing up.</Text> : null}
    </View>
    <View style={s.sections}>
      <DestinationRow title="Ideas in Malaysia" subtitle="Good food, familiar places, a change of pace." destinations={malaysiaDestinations} testID="malaysia-destinations" />
      <DestinationRow title="A little further away" subtitle="A few places to start your next idea." destinations={worldDestinations} testID="world-destinations" />
      <Pressable accessibilityRole="button" onPress={() => router.push('/inspiration')} style={s.saved}>
        <Text style={s.heading}>A trip starts with an idea</Text><Text style={s.body}>Keep travel links in Saved, ready for when you are.</Text><Text style={s.linkText}>Open saved ideas →</Text>
      </Pressable>
    </View>
  </Screen>;
}
const s = StyleSheet.create({
  brand: { gap: 8, paddingVertical: 8 }, brandNote: { color: colors.textMuted, fontSize: 12 },
  hero: { paddingTop: 28, paddingBottom: 24, gap: 16 }, title: { color: colors.ink, fontSize: 36, lineHeight: 42, fontWeight: '700', letterSpacing: -1 },
  body: { color: colors.textMuted, fontSize: 16, lineHeight: 24 }, heading: { color: colors.ink, fontSize: 22, fontWeight: '700' },
  resume: { backgroundColor: colors.surfaceTint, borderRadius: 16, padding: 20, gap: 12, marginBottom: 16 }, caption: { color: colors.sky, fontSize: 14, fontWeight: '600' },
  actions: { gap: 4 }, link: { minHeight: 48, justifyContent: 'center', alignItems: 'center', padding: 12 }, linkText: { color: colors.sky, fontSize: 15, fontWeight: '600' }, note: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
  sections: { gap: 32, marginTop: 36 }, saved: { paddingVertical: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, gap: 12 },
});
