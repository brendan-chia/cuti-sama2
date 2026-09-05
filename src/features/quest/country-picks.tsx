import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { countries, countryByCode, searchCountries } from '../../../packages/contracts/src/countries';
import type { QuestAction, QuestCountryCode, QuestRoom } from '../../../packages/contracts/src/quest';
import { AppButton } from '@/components/app-button';
import { FormField } from '@/components/form-field';
import { colors, radius, spacing } from '@/theme/tokens';
import { questStyles as s } from './quest-styles';

type Props = { room: QuestRoom; busy: boolean; act: (action: QuestAction) => Promise<boolean> };

export function CountryPicks({ room, busy, act }: Props) {
  const [selected, setSelected] = useState<QuestCountryCode[]>(room.ownPicks);
  const [query, setQuery] = useState('');
  const submitted = room.members.find((member) => member.memberId === room.currentMemberId)?.picksSubmitted;
  const [editing, setEditing] = useState(false);
  const visible = searchCountries(query);
  function toggle(code: QuestCountryCode) {
    setSelected((current) => current.includes(code) ? current.filter((item) => item !== code) : current.length < 3 ? [...current, code] : current);
  }
  if (submitted && !editing) return <View style={s.stack}>
    <View style={s.success}><Text style={s.heading}>Your wishlist is on the table.</Text><Text style={s.body}>Everyone’s picks stay hidden until the whole group has submitted. Your countries will become part of the shared voting deck.</Text>
      {room.ownPicks.map((code) => <Text key={code} style={s.strong}>{countryByCode(code)?.flag} {countryByCode(code)?.name}</Text>)}
    </View>
    <AppButton label="Edit my picks" variant="secondary" disabled={busy} onPress={() => { setSelected(room.ownPicks); setEditing(true); }} />
  </View>;
  return <View style={s.stack}>
    <View style={styles.slots} accessibilityLabel={`${selected.length} of 3 country slots filled`}>
      {[0, 1, 2].map((index) => {
        const country = countryByCode(selected[index]);
        return <Pressable key={index} accessibilityRole="button" accessibilityLabel={country ? `Remove ${country.name}` : `Empty country slot ${index + 1}`} disabled={!country || busy} onPress={() => toggle(country!.code)} style={[styles.slot, country && styles.filled]}>
          <Text style={styles.slotIcon}>{country?.flag ?? '+'}</Text><Text numberOfLines={1} style={styles.slotLabel}>{country?.name ?? `Pick ${index + 1}`}</Text>
        </Pressable>;
      })}
    </View>
    <FormField label="Find a country" onChangeText={setQuery} value={query} placeholder="Japan, Thailand, Italy…" />
    <Text accessibilityLiveRegion="polite" style={s.small}>{selected.length === 3 ? 'All three slots filled. Remove a pick to swap it.' : `${3 - selected.length} slots left · choose at least one country`}</Text>
    <View style={styles.grid}>{visible.map((country) => {
      const chosen = selected.includes(country.code); const disabled = busy || (!chosen && selected.length >= 3);
      return <Pressable key={country.code} accessibilityRole="checkbox" accessibilityLabel={country.name} accessibilityState={{ checked: chosen, disabled }} disabled={disabled} onPress={() => toggle(country.code)} style={({ pressed }) => [styles.country, chosen && styles.chosen, disabled && !chosen && s.disabled, pressed && s.pressed]}>
        <Text style={styles.flag}>{country.flag}</Text><Text style={[styles.countryName, chosen && { color: colors.midnight }]}>{country.name}</Text><Text style={chosen ? styles.check : s.small}>{chosen ? '✓' : '+'}</Text>
      </Pressable>;
    })}</View>
    {!visible.length ? <Text style={s.body}>No country found in this collection. Try another name.</Text> : null}
    <Text style={s.small}>A collection of {countries.length} countries to explore together. Each country appears only once in the voting deck, even if several people pick it.</Text>
    <AppButton label={`Submit ${selected.length || 'your'} ${selected.length === 1 ? 'country' : 'countries'}`} testID="submit-country-picks" disabled={!selected.length} loading={busy} onPress={() => void act({ type: 'picks', countryCodes: selected }).then((saved) => { if (saved) setEditing(false); })} />
  </View>;
}

const styles = StyleSheet.create({
  slots: { flexDirection: 'row', gap: spacing.sm },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.midnightRaised, borderColor: colors.border, borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.md, minHeight: 106, padding: spacing.sm },
  filled: { borderStyle: 'solid', borderColor: colors.sky, backgroundColor: colors.midnightSoft },
  slotIcon: { fontSize: 30, color: colors.textMuted }, slotLabel: { color: colors.white, fontSize: 12, fontWeight: '700' },
  grid: { gap: spacing.sm, flexDirection: 'row', flexWrap: 'wrap' },
  country: { width: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 62, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.midnightRaised },
  chosen: { backgroundColor: colors.sky }, flag: { fontSize: 23 }, countryName: { color: colors.white, flex: 1, fontWeight: '600', fontSize: 13 }, check: { color: colors.midnight, fontWeight: '900' },
});
