import { useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { normalizeSocialUrl, type PlaceImportResult } from '../../../packages/contracts/src/place-import';
import type { QuestRoom } from '../../../packages/contracts/src/quest';
import { AppButton } from '@/components/app-button';
import { FormField } from '@/components/form-field';
import { colors, radius, spacing } from '@/theme/tokens';
import { confirmTripPlaces, importTripPlaces } from './place-import-service';
import { VideoImportPanel } from './video-import-panel';
import { isSocialVideoUrl } from '../../../packages/contracts/src/social-video';
import { questStyles as s } from './quest-styles';

type Props = { tripId: string; countryName: string; disabled?: boolean; onConfirmed: (room: QuestRoom) => void; importAction?: typeof importTripPlaces; confirmAction?: typeof confirmTripPlaces };
export function PlaceImportPanel({ tripId, countryName, disabled, onConfirmed, importAction = importTripPlaces, confirmAction = confirmTripPlaces }: Props) {
  const [open, setOpen] = useState(false);
  const [sourceUrl, setSourceUrl] = useState('');
  const [captionOnly, setCaptionOnly] = useState(false);
  const videoMode = !captionOnly && isSocialVideoUrl(sourceUrl);
  const [text, setText] = useState('');
  const [image, setImage] = useState<string>();
  const [showFallback, setShowFallback] = useState(false);
  const [result, setResult] = useState<PlaceImportResult | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  async function find() {
    if (working.current || disabled) return;
    working.current = true; setBusy(true); setError(null); setSaved(false); setResult(null); setSelected([]);
    try {
      const url = sourceUrl.trim() ? normalizeSocialUrl(sourceUrl.trim()) : '';
      const next = await importAction(tripId, { sourceUrl: url, text: text.trim(), ...(image ? { image } : {}) });
      setResult(next);
      if (next.status === 'needs_input') setShowFallback(true);
    } catch (cause) { setShowFallback(true); setError(cause instanceof Error ? cause.message : 'Could not read this public post. Please try again.'); }
    finally { working.current = false; setBusy(false); }
  }
  async function pickImage() {
    if (working.current || disabled) return;
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.6 });
      if (picked.canceled) return;
      const base64 = picked.assets[0]?.base64;
      if (!base64 || base64.length > 4_000_000) throw new Error('Choose a screenshot under 3 MB.');
      const mime = base64.startsWith('iVBOR') ? 'image/png' : base64.startsWith('UklGR') ? 'image/webp' : base64.startsWith('/9j/') ? 'image/jpeg' : null;
      if (!mime) throw new Error('Choose a JPEG, PNG, or WebP screenshot.');
      setImage(`data:${mime};base64,${base64}`); setResult(null); setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not open your photos.'); }
  }
  async function confirm() {
    if (working.current || disabled || !result || !selected.length) return;
    working.current = true; setBusy(true); setError(null);
    try {
      const room = await confirmAction(result.importId, selected);
      onConfirmed(room); setSaved(true); setResult(null); setSelected([]); setText(''); setImage(undefined); setShowFallback(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not confirm these places.'); }
    finally { working.current = false; setBusy(false); }
  }
  return <View style={styles.panel} testID="place-import-panel">
    <Text style={s.kicker}>FROM YOUR FEED TO YOUR NEXT TRIP</Text>
    <Text style={s.heading}>Saw it. Saved it. Let’s find it.</Text>
    <Text style={s.body}>Bring a travel post to the map. Find the places in {countryName}, then check that we got them right.</Text>
    {!open ? <AppButton label="＋ Add a travel post" onPress={() => setOpen(true)} disabled={disabled} /> : <View style={s.stack}>
      <FormField label="Social post link" placeholder="Paste a TikTok, Instagram, or YouTube link" autoCapitalize="none" autoCorrect={false} value={sourceUrl} editable={!busy && !disabled} onChangeText={(value) => { setSourceUrl(value); setCaptionOnly(false); setResult(null); setSaved(false); setError(null); setText(''); setImage(undefined); setShowFallback(false); }} />
      {videoMode ? <VideoImportPanel tripId={tripId} sourceUrl={sourceUrl} caption="" disabled={disabled} onConfirmed={onConfirmed} onFallback={() => { setCaptionOnly(true); setShowFallback(true); }} /> : <>
      <Text style={s.small}>We’ll read the public caption for place names. For names shown only in a photo or carousel slide, add a screenshot. Only places you confirm are shared with your crew.</Text>
      {showFallback ? <View style={s.stack}>
        <FormField label="Caption or place names" placeholder="Paste the caption or the names shown in the post" multiline maxLength={6000} value={text} editable={!busy && !disabled} onChangeText={setText} />
        <Text style={s.small}>The caption or screenshot you submit is sent to our AI reader.</Text>
        <AppButton label={image ? 'Replace screenshot' : 'Add a screenshot'} variant="secondary" disabled={busy || disabled} onPress={() => void pickImage()} />
        {image ? <><Text style={s.small}>Screenshot attached. Choose Find the places to read it.</Text><AppButton label="Remove screenshot" variant="secondary" disabled={busy || disabled} onPress={() => setImage(undefined)} /></> : null}
      </View> : <AppButton label="Use a caption or screenshot" variant="secondary" disabled={busy || disabled} onPress={() => setShowFallback(true)} />}
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
      </>}
      {saved ? <Text accessibilityLiveRegion="polite" style={s.strong}>✓ Places confirmed. Your crew can now find them on the map.</Text> : null}
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  panel: { backgroundColor: colors.surfaceTint, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, borderWidth: 1, borderColor: colors.border },
  candidate: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  choice: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm }, copy: { flex: 1, gap: 5 },
  checkbox: { fontSize: 26, color: colors.sky }, evidence: { color: colors.textMuted, fontSize: 12, fontStyle: 'italic' },
});
