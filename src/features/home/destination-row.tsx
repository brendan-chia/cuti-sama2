import { Link } from 'expo-router';
import { Image, type ImageSource } from 'expo-image';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/theme/tokens';

type Destination = { name: string; region: string; detail: string; image: ImageSource; credit?: { author: string; url: `https://${string}` } };
// Curated inspiration, not a live popularity ranking. Home country is Malaysia.
export const malaysiaDestinations: Destination[] = [
  { name: 'Kuala Lumpur', region: 'Federal Territory', detail: 'City lights & food streets', image: require('../../../assets/images/destinations/kuala-lumpur.jpg') },
  { name: 'Ipoh', region: 'Perak', detail: 'White coffee & old-town walks', image: require('../../../assets/images/destinations/ipoh.jpg') },
  { name: 'George Town', region: 'Penang', detail: 'Heritage lanes & hawker favourites', image: require('../../../assets/images/destinations/george-town.jpg') },
  { name: 'Melaka', region: 'Melaka', detail: 'Heritage streets & riverside walks', image: require('../../../assets/images/destinations/melaka.jpg'), credit: { author: 'Philip Nalangan', url: 'https://commons.wikimedia.org/wiki/File:Malacca_River_Melaka.jpg' } },
  { name: 'Port Dickson', region: 'Negeri Sembilan', detail: 'Beach days & seaside sunsets', image: require('../../../assets/images/destinations/port-dickson.jpg'), credit: { author: 'Malaysiaguy2010', url: 'https://commons.wikimedia.org/wiki/File:Port-dickson-beach-1.jpg' } },
];
export const worldDestinations: Destination[] = [
  { name: 'Japan', region: 'East Asia', detail: 'Temple trails & city discoveries', image: require('../../../assets/images/destinations/japan.jpg') },
  { name: 'New York City', region: 'United States', detail: 'Skyline views & neighbourhood days', image: require('../../../assets/images/destinations/new-york.jpg') },
  { name: 'London', region: 'United Kingdom', detail: 'Museums, markets & riverside walks', image: require('../../../assets/images/destinations/london.jpg') },
  { name: 'Bali', region: 'Indonesia', detail: 'Island mornings & temple sunsets', image: require('../../../assets/images/destinations/bali.jpg') },
  { name: 'Paris', region: 'France', detail: 'Neighbourhood cafés & art-filled days', image: require('../../../assets/images/destinations/paris.jpg') },
];
function DestinationCard({ destination }: { destination: Destination }) {
  const [failed, setFailed] = useState(false);
  return <View style={s.card}>
    <View style={s.imageFrame}>{failed ? <View style={s.fallback}><Text style={s.name}>{destination.name}</Text><Text style={s.detail}>Photo unavailable</Text></View> : <Image source={destination.image} style={s.image} contentFit="cover" accessibilityLabel={destination.name} onError={() => setFailed(true)} />}</View>
    <Text style={s.region}>{destination.region}</Text><Text style={s.name}>{destination.name}</Text><Text style={s.detail}>{destination.detail}</Text>
    {destination.credit ? <Link href={destination.credit.url} style={s.credit} accessibilityLabel={`Photo credit: ${destination.credit.author}, source and license`}>Photo: {destination.credit.author}</Link> : null}
  </View>;
}
export function DestinationRow({ title, subtitle, destinations, testID }: { title: string; subtitle: string; destinations: Destination[]; testID: string }) {
  const scroll = useRef<ScrollView>(null);
  const position = useRef(0);
  const [viewport, setViewport] = useState(0);
  const [offset, setOffset] = useState(0);
  const maxOffset = Math.max(0, destinations.length * 216 - 16 - viewport);
  function move(direction: number) {
    const next = Math.max(0, Math.min(maxOffset, position.current + direction * 216));
    scroll.current?.scrollTo({ x: next, animated: false });
    position.current = next; setOffset(next);
  }
  return <View style={s.section}>
    <View style={s.headingRow}><Text accessibilityRole="header" style={s.heading}>{title}</Text><View style={s.controls}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Previous ${title}`} aria-disabled={offset <= 0} accessibilityState={{ disabled: offset <= 0 }} disabled={offset <= 0} onPress={() => move(-1)} style={({ pressed }) => [s.arrow, offset <= 0 && s.disabled, pressed && s.pressed]}><Text style={s.arrowText}>‹</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Next ${title}`} aria-disabled={offset >= maxOffset} accessibilityState={{ disabled: offset >= maxOffset }} disabled={offset >= maxOffset} onPress={() => move(1)} style={({ pressed }) => [s.arrow, offset >= maxOffset && s.disabled, pressed && s.pressed]}><Text style={s.arrowText}>›</Text></Pressable>
    </View></View>
    <Text style={s.subtitle}>{subtitle}</Text>
    <ScrollView ref={scroll} horizontal testID={testID} showsHorizontalScrollIndicator={false} contentContainerStyle={s.track} onLayout={event => setViewport(event.nativeEvent.layout.width)} onScroll={event => { position.current = event.nativeEvent.contentOffset.x; setOffset(position.current); }} scrollEventThrottle={100}>
      {destinations.map(destination => <DestinationCard key={destination.name} destination={destination} />)}
    </ScrollView>
  </View>;
}
const s = StyleSheet.create({
  section: { gap: 8 }, headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, heading: { color: colors.destinationTitle, fontSize: 25, lineHeight: 31, fontWeight: '900', flex: 1, letterSpacing: -0.5 }, subtitle: { color: colors.onAction, fontSize: 13, lineHeight: 20, marginBottom: 8 },
  controls: { flexDirection: 'row', gap: 4 }, arrow: { width: 44, height: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }, arrowText: { fontSize: 27, color: colors.onAction, lineHeight: 30 }, disabled: { opacity: 0.35 }, pressed: { opacity: 0.65 },
  track: { gap: 16, paddingBottom: 8 }, card: { width: 200, gap: 5 }, imageFrame: { height: 180, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceTint, marginBottom: 7 }, image: { width: '100%', height: '100%' }, fallback: { flex: 1, padding: 16, justifyContent: 'center', gap: 8 },
  credit: { color: colors.onAction, fontSize: 12, lineHeight: 18, textDecorationLine: 'underline', paddingVertical: 13 },
  region: { fontSize: 12, color: colors.onAction, fontWeight: '700' }, name: { fontSize: 21, lineHeight: 27, color: colors.destinationTitle, fontWeight: '800', letterSpacing: -0.3 }, detail: { color: colors.onAction, fontSize: 13, lineHeight: 20 },
});
