import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { TripList } from '@/features/profile/trip-list';
import { Screen } from '@/components/screen';
import { AppButton } from '@/components/app-button';
import { FormField } from '@/components/form-field';
import { questStyles as s } from '@/features/quest/quest-styles';
import { loadProfile, saveProfile, loadMyTrips, travellerRpc, type MyTrip } from '@/features/profile/service';
import { requireSupabase } from '@/lib/supabase';
import { saveIdentityMarker } from '@/lib/secure-storage';

export default function Profile() {
  const router = useRouter();
  const { section } = useLocalSearchParams<{ section?: string }>();
  const showPassport = section === 'passport';
  const showSettings = section === 'settings';
  const showTrips = section === 'trips';
  const [switching, setSwitching] = useState(false);
  const [name, setName] = useState(''); const [avatar, setAvatar] = useState<string | null>(null);
  const [places, setPlaces] = useState(''); const [code, setCode] = useState(''); const [referral, setReferral] = useState('');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [trips, setTrips] = useState<MyTrip[]>([]); const [completed, setCompleted] = useState(new Set<string>());
  const [busy, setBusy] = useState(false); const [loaded, setLoaded] = useState(false); const [message, setMessage] = useState('');
  async function refresh() {
    const [profile, history] = await Promise.all([loadProfile(), loadMyTrips()]);
    setName(profile.display_name); setAvatar(profile.avatar_url); setPlaces(profile.favourite_places.join('\n')); setCode(profile.referral_code);
    setTrips(history.trips); setCompleted(history.completed); setLoaded(true);
  }
  async function run(action: () => Promise<unknown>, success = '') {
    setBusy(true); setMessage('');
    try { await action(); setMessage(success); } catch (e) { setMessage(e instanceof Error ? e.message : 'Please try again.'); } finally { setBusy(false); }
  }
  useEffect(() => {
    let active = true;
    void Promise.all([loadProfile(), loadMyTrips()]).then(([profile, history]) => {
      if (!active) return;
      setName(profile.display_name); setAvatar(profile.avatar_url); setPlaces(profile.favourite_places.join('\n')); setCode(profile.referral_code);
      setTrips(history.trips); setCompleted(history.completed); setLoaded(true);
    }).catch(e => { if (active) setMessage(e instanceof Error ? e.message : 'Could not load profile.'); });
    return () => { active = false; };
  }, []);
  async function photo() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.4, base64: true });
    if (result.canceled) return;
    const encoded = result.assets[0].base64;
    if (!encoded || encoded.length > 1400000) throw new Error('Choose a smaller photo (under 1 MB).');
    setAvatar(`data:image/jpeg;base64,${encoded}`);
  }
  return <Screen><View style={s.stack}>
    <Text style={s.title}>{section === 'settings' ? 'Account settings' : section === 'trips' ? 'My trips & memories' : 'Account'}</Text>
    {section ? <AppButton label="Back to account" variant="secondary" onPress={() => router.replace('/profile')} /> : null}
    {!section ? <><Text style={s.body}>{loaded ? `Hello, ${name || 'traveller'}.` : 'Loading your account…'}</Text><AppButton label="Keep trips across devices" onPress={() => router.push({ pathname: '/profile', params: { section: 'settings' } })} /><AppButton label="Edit profile" variant="secondary" onPress={() => router.push({ pathname: '/profile', params: { section: 'passport' } })} /></> : null}
    {showPassport ? <AppButton label="My trips & memories" variant="secondary" onPress={() => router.push('/trips')} /> : null}
    {showPassport ? <AppButton label="Saved inspiration" variant="secondary" onPress={() => router.push('/inspiration')} /> : null}
    {showPassport ? <Text style={s.body}>Keep your favourites, memories and next adventures together.</Text> : null}
    {message ? <Text accessibilityRole="alert" style={s.body}>{message}</Text> : null}
    {!loaded ? <AppButton label="Retry loading profile" disabled={busy} onPress={() => void run(refresh)} /> : showPassport ? <>
    <View style={s.panel}>
      {avatar ? <Image source={{ uri: avatar }} accessibilityLabel="Your profile picture" style={{ width: 88, height: 88, borderRadius: 44 }} /> : <Text style={s.title}>✈</Text>}
      <AppButton label="Choose profile picture" variant="secondary" disabled={busy} onPress={() => void run(photo)} />
      <FormField label="Display name" value={name} onChangeText={setName} maxLength={50} />
      <FormField label="Favourite places" hint="One place per line, up to 30." multiline value={places} onChangeText={setPlaces} />
      <AppButton label="Save profile" disabled={busy} onPress={() => void run(() => saveProfile(name, avatar, [...new Set(places.split('\n').map(p => p.trim()).filter(Boolean))]), 'Profile saved.')} />
      <Text style={s.strong}>{completed.size ? `★ First adventure · ${completed.size} completed trip${completed.size === 1 ? '' : 's'}` : 'Your first-adventure badge awaits your first completed trip.'}</Text>
    </View>
    <View style={s.panel}><Text style={s.heading}>Bring someone along</Text><Text selectable style={s.strong}>{code}</Text>
      <AppButton label="Copy referral code" disabled={busy} variant="secondary" onPress={() => void run(() => Clipboard.setStringAsync(code), 'Referral code copied.')} />
      <FormField label="A friend's referral code" value={referral} onChangeText={setReferral} autoCapitalize="none" maxLength={16} />
      <AppButton label="Apply referral" disabled={busy || !referral.trim()} onPress={() => void run(() => travellerRpc('redeem_referral', { p_code: referral }), 'Referral applied.')} />
    </View>
    </> : null}
    {showSettings ? <View style={s.panel}><Text style={s.heading}>Keep your account across devices</Text><Text style={s.body}>Link this guest profile to an email and password. Confirm the email before signing in elsewhere.</Text>
      <FormField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <FormField label="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <AppButton label="Link my guest account" disabled={busy || !loaded || !email || password.length < 8} onPress={() => void run(async () => { const { error } = await requireSupabase().auth.updateUser({ email: email.trim(), password }); if (error) throw error; setPassword(''); }, 'Check your email to confirm your account.')} />
      <Text style={s.small}>Signing in to an existing account switches profiles; guest trips are not merged.</Text>
      <AppButton label="Sign in to existing account" variant="secondary" disabled={busy || !email || !password} onPress={() => setSwitching(true)} />
      {switching ? <><Text style={s.body}>Switch accounts? Your current guest trips will not move to the other account. Link this guest account first if you need to keep access.</Text><AppButton label="Switch to existing account" variant="secondary" disabled={busy || !email || !password} onPress={() => void run(async () => { const { data, error } = await requireSupabase().auth.signInWithPassword({ email: email.trim(), password }); if (error) throw error; await saveIdentityMarker(data.user.id); setPassword(''); await refresh(); }, 'Signed in.')} /><AppButton label="Keep current account" variant="secondary" onPress={() => setSwitching(false)} /></> : null}
    </View> : null}
    {loaded && showTrips ? <>
    {!section ? <Text style={s.heading}>My trips & memories</Text> : null}
    <TripList key={trips.map(trip => trip.id).join(',')} trips={trips} completed={completed} busy={busy}
      onOpen={tripId => router.push({ pathname: '/trip/[tripId]', params: { tripId } })}
      onComplete={tripId => void run(async () => { await travellerRpc('record_completed_trip', { p_trip_id: tripId }); await refresh(); }, 'Trip added to your memories.')}
      onManage={tripId => router.push({ pathname: '/discover', params: { tripId } })} />
    </> : null}
  </View></Screen>;
}
