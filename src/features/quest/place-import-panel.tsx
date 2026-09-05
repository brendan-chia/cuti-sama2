import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { normalizeSocialUrl, type PlaceImportResult } from '../../../packages/contracts/src/place-import';
import type { QuestRoom } from '../../../packages/contracts/src/quest';
import { AppButton } from '@/components/app-button';
import { FormField } from '@/components/form-field';
import { colors, radius, spacing } from '@/theme/tokens';
import { confirmTripPlaces, importTripPlaces } from './place-import-service';
import { questStyles as s } from './quest-styles';

type Props = { tripId: string; countryName: string; disabled?: boolean; onConfirmed: (room: QuestRoom) => void; importAction?: typeof importTripPlaces; confirmAction?: typeof confirmTripPlaces };
export function PlaceImportPanel({ tripId, countryName, disabled, onConfirmed, importAction = importTripPlaces, confirmAction = confirmTripPlaces }: Props) {
  const [open, setOpen] = useState(false);
  const [sourceUrl, setSourceUrl] = useState('');
  const [text, setText] = useState('');
  const [image, setImage] = useState<string>();
  const [result, setResult] = useState<PlaceImportResult | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  async function pickImage() {
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.6 });
      if (picked.canceled) return;
      const asset = picked.assets[0];
      if (!asset.base64 || asset.base64.length > 4_000_000) throw new Error('Choose a smaller screenshot, under 3 MB.');
      setImage(`data:${asset.base64.startsWith('iVBOR') ? 'image/png' : asset.base64.startsWith('UklGR') ? 'image/webp' : 'image/jpeg'};base64,${asset.base64}`);
      setResult(null); setSaved(false); setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not open your photos.'); }
  }
  async function find() {
    if (working.current || disabled) return;
    working.current = true; setBusy(true); setError(null); setSaved(false); setResult(null); setSelected([]);
    try {
      const url = sourceUrl.trim() ? normalizeSocialUrl(sourceUrl.trim()) : '';
      setResult(await importAction(tripId, { sourceUrl: url, text: text.trim(), image }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not find places. Try a caption.'); }
    finally { working.current = false; setBusy(false); }
  }
  async function confirm() {
    if (working.current || disabled || !result || !selected.length) return;
    working.current = true; setBusy(true); setError(null);
    try {
      const room = await confirmAction(result.importId, selected);
      onConfirmed(room); setSaved(true); setResult(null); setImage(undefined); setSelected([]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not confirm these places.'); }
    finally { working.current = false; setBusy(false); }
  }
  return <View style={styles.panel} testID="place-import-panel">
    <Text style={s.kicker}>FROM YOUR FEED TO YOUR NEXT TRIP</Text>
    <Text style={s.heading}>Saw it. Saved it. Let’s find it.</Text>
    <Text style={s.body}>Bring a travel post to the map. Find the places in {countryName}, then check that we got them right.</Text>
    {!open ? <AppButton label="＋ Add a travel post" onPress={() => setOpen(true)} disabled={disabled} /> : <View style={s.stack}>
      <FormField label="Social post link" placeholder="Paste a TikTok, Instagram, or YouTube link" autoCapitalize="none" autoCorrect={false} value={sourceUrl} editable={!busy && !disabled} onChangeText={(value) => { setSourceUrl(value); setResult(null); setSaved(false); }} />
      <FormField label="Caption or place names" placeholder={'Paste the caption, or add one place per line\ne.g. Kek Lok Si Temple, Penang'} multiline maxLength={6000} value={text} editable={!busy && !disabled} onChangeText={(value) => { setText(value); setResult(null); setSaved(false); }} />
      <Text style={s.small}>Public TikTok captions may be readable. For other or inaccessible posts, add the caption or a screenshot with visible place names. No social login needed.</Text>
      {image ? <View style={s.stack}><Image source={{ uri: image }} style={styles.screenshot} contentFit="contain" accessibilityLabel="Screenshot to read for place names" /><AppButton label="Remove screenshot" variant="secondary" disabled={busy || disabled} onPress={() => { setImage(undefined); setResult(null); }} /></View> : <AppButton label="Add a screenshot" variant="secondary" disabled={busy || disabled} onPress={() => void pickImage()} />}
      <Text style={s.small}>The text or screenshot you submit is sent to our AI reader. Only the places you confirm and the source link are shared with your crew.</Text>
      <AppButton label={busy ? 'Finding possible places…' : 'Find the places'} loading={busy} disabled={disabled || (!sourceUrl.trim() && !text.trim() && !image)} onPress={() => void find()} />
      {result ? <View style={s.stack}>
        <Text accessibilityLiveRegion="polite" style={s.body}>{result.message}</Text>
        {result.candidates.map((place) => <View key={place.id} style={styles.candidate}>
          <Pressable accessibilityRole="checkbox" accessibilityLabel={`Confirm ${place.name}`} accessibilityState={{ checked: selected.includes(place.id), disabled: busy || disabled }} disabled={busy || disabled} onPress={() => setSelected((current) => current.includes(place.id) ? current.filter((id) => id !== place.id) : [...current, place.id])} style={styles.choice}>
            <Text style={styles.checkbox}>{selected.includes(place.id) ? '☑' : '□'}</Text><View style={styles.copy}><Text style={s.strong}>{place.name}</Text><Text style={s.small}>{place.address}</Text><Text style={styles.evidence}>{place.evidence}</Text></View>
          </Pressable>
          <Pressable accessibilityRole="link" accessibilityLabel={`Check ${place.name} on OpenStreetMap`} onPress={() => void Linking.openURL(place.sourceUrl).catch(() => setError('Could not open the map. Please try again.'))}><Text style={s.link}>Check on OpenStreetMap ↗</Text></Pressable>
        </View>)}
        {result.candidates.length ? <><Text style={s.small}>Choose the matching locations, not every alternative. Place data © OpenStreetMap contributors.</Text><AppButton label={`Confirm ${selected.length} ${selected.length === 1 ? 'place' : 'places'}`} disabled={disabled || !selected.length} loading={busy} onPress={() => void confirm()} /></> : null}
      </View> : null}
      {saved ? <Text accessibilityLiveRegion="polite" style={s.strong}>✓ Places confirmed. Your crew can now find them on the map.</Text> : null}
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  panel: { backgroundColor: colors.surfaceTint, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, borderWidth: 1, borderColor: colors.border },
  screenshot: { height: 180, borderRadius: radius.md, width: '100%' },
  candidate: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  choice: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm }, copy: { flex: 1, gap: 5 },
  checkbox: { fontSize: 26, color: colors.sky }, evidence: { color: colors.textMuted, fontSize: 12, fontStyle: 'italic' },
});
