import { Image } from 'expo-image';
import { useCallback, useMemo, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { countryByCode, type Country } from '../../../packages/contracts/src/countries';
import type { QuestAction, QuestCountryCode, QuestRoom } from '../../../packages/contracts/src/quest';
import { AppButton } from '@/components/app-button';
import { useReducedMotion } from '@/theme/motion';
import { colors, radius, spacing } from '@/theme/tokens';
import { questStyles as s } from './quest-styles';

type Props = { room: QuestRoom; busy: boolean; act: (action: QuestAction) => Promise<boolean> };

function SwipeCard({ country, disabled, vote }: { country: Country; disabled: boolean; vote: (agree: boolean) => Promise<boolean> }) {
  const [x] = useState(() => new Animated.Value(0));
  const reduced = useReducedMotion();
  const [imageFailed, setImageFailed] = useState(false);
  const [direction, setDirection] = useState<'AGREE' | 'PASS' | null>(null);
  const reset = useCallback(() => { setDirection(null); if (reduced) x.setValue(0); else Animated.spring(x, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 160 }).start(); }, [reduced, x]);
  const commit = useCallback(async (agree: boolean) => {
    if (disabled) { reset(); return; }
    // The deck advances only after the server acknowledges this vote.
    const saved = await vote(agree);
    if (!saved) reset();
  }, [disabled, reset, vote]);
  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => !disabled && Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4,
    onPanResponderMove: (_, gesture) => { if (!reduced) x.setValue(gesture.dx); setDirection(gesture.dx > 30 ? 'AGREE' : gesture.dx < -30 ? 'PASS' : null); },
    onPanResponderRelease: (_, gesture) => { if (Math.abs(gesture.dx) > 85) void commit(gesture.dx > 0); else reset(); },
    onPanResponderTerminate: reset,
  }), [disabled, commit, reset, reduced, x]);
  return <View style={s.stack}>
    <View style={styles.deck}>
      <View style={styles.underCard} />
      <Animated.View testID="country-swipe-card" {...responder.panHandlers} style={[styles.card, { transform: [{ translateX: x }, { rotate: x.interpolate({ inputRange: [-220, 0, 220], outputRange: ['-9deg', '0deg', '9deg'], extrapolate: 'clamp' }) }] }]}>
        <View style={styles.photo}>
          {!imageFailed ? <Image accessibilityLabel={`Travel inspiration for ${country.name}`} source={{ uri: country.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" onError={() => setImageFailed(true)} /> : <Text style={styles.fallbackFlag}>{country.flag}</Text>}
          <View style={styles.photoTag}><Text style={styles.photoTagText}>THE GROUP’S WISHLIST</Text></View>
          {direction ? <View style={[styles.stamp, direction === 'PASS' && styles.passStamp]}><Text style={styles.stampText}>{direction}</Text></View> : null}
        </View>
        <View style={styles.caption}><Text style={styles.countryTitle}>{country.flag} {country.name}</Text><Text style={styles.tagline}>{country.tagline}</Text></View>
      </Animated.View>
    </View>
    <View style={styles.voteButtons}>
      <Pressable accessibilityLabel={`Disagree with ${country.name}`} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={() => void commit(false)} style={({ pressed }) => [styles.voteButton, styles.pass, disabled && s.disabled, pressed && s.pressed]}><Text style={styles.passText}>×</Text><Text style={s.strong}>Pass</Text></Pressable>
      <Pressable accessibilityLabel={`Agree with ${country.name}`} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={() => void commit(true)} style={({ pressed }) => [styles.voteButton, styles.agree, disabled && s.disabled, pressed && s.pressed]}><Text style={styles.agreeIcon}>✓</Text><Text style={styles.agreeText}>Let’s go</Text></Pressable>
    </View>
    <Text style={styles.swipeHint}>{disabled ? 'Saving your vote…' : 'Swipe left to pass · swipe right to agree\nYou can also use the buttons.'}</Text>
  </View>;
}

export function CountryVote({ room, busy, act }: Props) {
  const [reviewing, setReviewing] = useState<QuestCountryCode | null>(null);
  const remaining = room.countries.filter((code) => !(code in room.ownVotes));
  const code = reviewing ?? remaining[0];
  const country = countryByCode(code);
  const organizer = room.currentRole === 'organizer';
  if (room.results.length) return <View style={s.stack}>
    <View style={s.success}><Text style={s.heading}>{room.tiedCountryCodes.length ? 'A photo finish.' : 'The group wants a fresh deck.'}</Text><Text style={s.body}>{room.tiedCountryCodes.length ? 'These countries have the same number of yes votes. The organiser chooses from the tied favourites.' : 'Every country received zero yes votes. The organiser can reopen wishlists so everyone can try new places.'}</Text></View>
    {room.results.map((result) => <View key={result.countryCode} style={s.between}><Text style={s.strong}>{countryByCode(result.countryCode)?.flag} {countryByCode(result.countryCode)?.name}</Text><Text style={s.body}>{result.agreeCount} / {room.members.length} yes</Text></View>)}
    {organizer ? room.tiedCountryCodes.length ? room.tiedCountryCodes.map((item) => <AppButton key={item} label={`Choose ${countryByCode(item)?.name}`} disabled={busy} onPress={() => void act({ type: 'resolve_tie', countryCode: item })} />) : <AppButton label="Open a fresh wishlist round" loading={busy} onPress={() => void act({ type: 'restart_picks' })} /> : <Text style={s.small}>Waiting for the organiser to continue.</Text>}
  </View>;
  return <View style={s.stack}>
    <Text style={s.small}>{organizer ? 'Your vote counts too. As organiser, you get the same ballot as every traveller.' : 'Your own ballot. Every traveller gets an equal say.'}</Text>
    <View style={s.between}><Text style={s.kicker}>{reviewing ? 'REVIEW YOUR VOTE' : country ? `CARD ${room.countries.length - remaining.length + 1} OF ${room.countries.length}` : 'DECK COMPLETE'}</Text><Text style={s.small}>{Object.keys(room.ownVotes).length} votes saved</Text></View>
    {country ? <SwipeCard key={country.code} country={country} disabled={busy} vote={async (agree) => { const saved = await act({ type: 'vote', countryCode: country.code, agree }); if (saved) setReviewing(null); return saved; }} /> : <View style={s.success}><Text style={s.heading}>You’ve played your hand.</Text><Text style={s.body}>The winner is revealed once everyone has voted on every country. Results stay hidden until then.</Text></View>}
    {Object.keys(room.ownVotes).length ? <View style={s.stack}><Text style={s.small}>YOUR VOTES · tap to revisit before the reveal</Text><View style={s.row}>{room.countries.filter((item) => item in room.ownVotes).map((item) => <Pressable key={item} accessibilityRole="button" accessibilityLabel={`Review vote for ${countryByCode(item)?.name}`} disabled={busy} onPress={() => setReviewing(item)} style={s.chip}><Text style={s.chipText}>{countryByCode(item)?.flag} {countryByCode(item)?.name} {room.ownVotes[item] ? '✓' : '×'}</Text></Pressable>)}</View></View> : null}
    {reviewing ? <AppButton label="Back to my deck" variant="secondary" onPress={() => setReviewing(null)} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  deck: { paddingHorizontal: 7, paddingBottom: 9 }, underCard: { position: 'absolute', top: 15, bottom: 0, left: 14, right: 14, backgroundColor: colors.sky, borderRadius: 22, transform: [{ rotate: '2deg' }] },
  card: { overflow: 'hidden', borderRadius: 20, backgroundColor: colors.sand }, photo: { height: 160, backgroundColor: colors.surfaceTint, alignItems: 'center', justifyContent: 'center' }, fallbackFlag: { fontSize: 80 },
  photoTag: { position: 'absolute', top: spacing.lg, left: spacing.lg, backgroundColor: colors.overlay, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 6 }, photoTagText: { color: colors.ink, fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  stamp: { position: 'absolute', top: 85, left: 24, backgroundColor: colors.sky, borderRadius: 6, padding: 16, transform: [{ rotate: '-12deg' }] }, passStamp: { backgroundColor: colors.coral }, stampText: { color: colors.ink, fontSize: 26, fontWeight: '900' },
  caption: { padding: spacing.lg, gap: spacing.sm }, countryTitle: { color: colors.ink, fontSize: 29, fontWeight: '900', letterSpacing: -0.7 }, tagline: { color: colors.ink, fontSize: 13, lineHeight: 19 },
  voteButtons: { flexDirection: 'row', gap: spacing.md }, voteButton: { minHeight: 62, borderRadius: radius.md, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md }, pass: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, agree: { backgroundColor: colors.sky }, passText: { fontSize: 30, color: colors.danger }, agreeIcon: { color: colors.paper, fontSize: 25 }, agreeText: { color: colors.paper, fontWeight: '800' }, swipeHint: { color: colors.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 20 },
});
