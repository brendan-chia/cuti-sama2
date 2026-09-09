import { useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { countries, countryByCode, searchCountries } from '../../../packages/contracts/src/countries';
import type { QuestAction, QuestCountryCode, QuestRoom } from '../../../packages/contracts/src/quest';
import { AppButton } from '@/components/app-button';
import { FormField } from '@/components/form-field';
import { colors, radius, spacing } from '@/theme/tokens';
import { questStyles as s } from './quest-styles';

type Props = { room: QuestRoom; busy: boolean; act: (action: QuestAction) => Promise<boolean> };

function CountryPhoto({ country }: { country: (typeof countries)[number] }) {
  const [failed, setFailed] = useState(false);
  return <View style={styles.photo}>
    <Text style={styles.photoFallback}>{country.flag}</Text>
    {!failed ? <Image source={{ uri: country.imageUrl }} accessibilityLabel={`Scenery in ${country.name}`} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} cachePolicy="memory-disk" onError={() => setFailed(true)} /> : null}
  </View>;
}

export function CountryPicks({ room, busy, act }: Props) {
  const solo = room.travelParty === 'solo';
  const limit = solo ? 1 : 3;
  const [selected, setSelected] = useState<QuestCountryCode[]>(room.ownPicks);
  const [query, setQuery] = useState('');
  const submitted = room.members.find((member) => member.memberId === room.currentMemberId)?.picksSubmitted;
  const [editing, setEditing] = useState(false);
  const visible = searchCountries(query);
  function toggle(code: QuestCountryCode) {
    setSelected((current) => current.includes(code) ? current.filter((item) => item !== code) : solo ? [code] : current.length < 3 ? [...current, code] : current);
  }
  if (!solo && submitted && !editing) return <View style={s.stack}>
    <View style={s.success}><Text style={s.heading}>Your wishlist is on the table.</Text><Text style={s.body}>Everyone’s picks stay hidden until the whole group has submitted. Your countries will become part of the shared voting deck.</Text>
      {room.ownPicks.map((code) => <Text key={code} style={s.strong}>{countryByCode(code)?.flag} {countryByCode(code)?.name}</Text>)}
    </View>
    <AppButton label="Edit my picks" variant="secondary" disabled={busy} onPress={() => { setSelected(room.ownPicks); setEditing(true); }} />
  </View>;
  return <View style={s.stack}>
    <View style={styles.slots} accessibilityLabel={`${selected.length} of ${limit} country slots filled`}>
      {Array.from({ length: limit }, (_, i) => i).map((index) => {
        const country = countryByCode(selected[index]);
        return <Pressable key={index} accessibilityRole="button" accessibilityLabel={country ? `Remove ${country.name}` : `Empty country slot ${index + 1}`} disabled={!country || busy} onPress={() => toggle(country!.code)} style={[styles.slot, country && styles.filled]}>
          {country ? <><CountryPhoto key={country.code} country={country} /><View style={styles.slotCaption}><Text numberOfLines={1} style={styles.selectedSlotLabel}>{country.name}</Text></View></> : <><Text style={styles.slotIcon}>+</Text><Text numberOfLines={1} style={styles.slotLabel}>{`Pick ${index + 1}`}</Text></>}
        </Pressable>;
      })}
    </View>
    <FormField label="Find a country" onChangeText={setQuery} value={query} placeholder="Japan, Thailand, Italy…" />
    <Text accessibilityLiveRegion="polite" style={s.small}>{solo ? 'Choose your destination. No voting needed.' : selected.length === 3 ? 'All three slots filled. Remove a pick to swap it.' : `${3 - selected.length} slots left · choose at least one country`}</Text>
    <View style={styles.grid}>{visible.map((country) => {
      const chosen = selected.includes(country.code); const disabled = busy || (!solo && !chosen && selected.length >= 3);
      return <Pressable key={country.code} accessibilityRole="checkbox" accessibilityLabel={country.name} accessibilityState={{ checked: chosen, disabled }} disabled={disabled} onPress={() => toggle(country.code)} style={({ pressed }) => [styles.country, chosen && styles.chosen, disabled && !chosen && s.disabled, pressed && s.pressed]}>
        <View style={styles.countryPhoto}><CountryPhoto key={country.code} country={country} /><View style={[styles.selection, chosen && styles.selectionChosen]}><Text style={[styles.selectionText, chosen && styles.check]}>{chosen ? '✓' : '+'}</Text></View></View>
        <View style={styles.caption}><Text style={[styles.countryName, chosen && styles.check]}>{country.name}</Text></View>
      </Pressable>;
    })}</View>
    {!visible.length ? <Text style={s.body}>No country found in this collection. Try another name.</Text> : null}
    {!solo ? <Text style={s.small}>A collection of {countries.length} countries to explore together. Each country appears only once in the voting deck, even if several people pick it.</Text> : null}
    <AppButton label={solo ? 'Choose destination & explore' : `Submit ${selected.length || 'your'} ${selected.length === 1 ? 'country' : 'countries'}`} testID="submit-country-picks" disabled={!selected.length} loading={busy} onPress={() => void act({ type: 'picks', countryCodes: selected }).then((saved) => { if (saved) setEditing(false); })} />
  </View>;
}

const styles = StyleSheet.create({
  slots: { flexDirection: 'row', gap: spacing.sm },
  slot: { flex: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.md, minHeight: 106, padding: spacing.sm },
  filled: { borderStyle: 'solid', borderColor: colors.sky, backgroundColor: colors.surfaceTint },
  slotIcon: { fontSize: 30, color: colors.textMuted }, slotLabel: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  grid: { gap: spacing.sm, flexDirection: 'row', flexWrap: 'wrap' },
  country: { width: '48%', flexGrow: 1, maxWidth: '50%', overflow: 'hidden', borderWidth: 2, borderColor: colors.surface, borderRadius: radius.md, backgroundColor: colors.surface },
  countryPhoto: { aspectRatio: 1.35 },
  photo: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.surfaceTint, alignItems: 'center', justifyContent: 'center' },
  photoFallback: { fontSize: 36, color: colors.textMuted },
  caption: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, minHeight: 48, justifyContent: 'center' },
  selection: { position: 'absolute', top: spacing.sm, right: spacing.sm, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  selectionChosen: { backgroundColor: colors.sky },
  selectionText: { color: colors.ink, fontSize: 19, fontWeight: '700' },
  slotCaption: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.sky, paddingVertical: spacing.sm, paddingHorizontal: 4 },
  selectedSlotLabel: { color: colors.paper, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  chosen: { backgroundColor: colors.sky, borderColor: colors.sky }, countryName: { color: colors.ink, fontWeight: '700', fontSize: 14 }, check: { color: colors.paper, fontWeight: '900' },
});
