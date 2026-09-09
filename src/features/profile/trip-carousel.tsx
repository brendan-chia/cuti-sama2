import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/app-button';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { MyTrip } from './service';

type Props = {
  trips: MyTrip[];
  completed: Set<string>;
  busy: boolean;
  onOpen: (id: string) => void;
  onComplete: (id: string) => void;
  onManage: (id: string) => void;
};

export function TripCarousel({ trips, completed, busy, onOpen, onComplete, onManage }: Props) {
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(300);
  const scroll = useRef<ScrollView>(null);
  const active = Math.min(index, Math.max(0, trips.length - 1));
  function go(next: number) {
    setIndex(next);
    scroll.current?.scrollTo({ x: next * width, animated: true });
  }
  if (!trips.length) return <Text style={styles.body}>Your trips will appear here when you start or join one.</Text>;
  return <View style={styles.stack}>
    <View onLayout={({ nativeEvent }) => {
      const next = nativeEvent.layout.width;
      if (next > 0 && next !== width) {
        setWidth(next);
        scroll.current?.scrollTo({ x: active * next, animated: false });
      }
    }}>
      <ScrollView ref={scroll} horizontal pagingEnabled showsHorizontalScrollIndicator={false} testID="trip-carousel"
        onMomentumScrollEnd={({ nativeEvent }) => setIndex(Math.max(0, Math.min(trips.length - 1, Math.round(nativeEvent.contentOffset.x / width))))}>
        {trips.map((trip, i) => <View key={trip.id} style={{ width, paddingHorizontal: 1 }} accessibilityElementsHidden={i !== active} importantForAccessibility={i !== active ? 'no-hide-descendants' : 'auto'}>
          <View style={styles.card}>
            <View style={styles.top}>
              <Text style={styles.badge}>{completed.has(trip.id) ? '★ A TRAVEL MEMORY' : '✈ YOUR NEXT CHAPTER'}</Text>
              <Text style={styles.number}>{String(i + 1).padStart(2, '0')}</Text>
            </View>
            <Text style={styles.title}>{trip.name}</Text>
            <Text style={styles.body}>{trip.travel_party === 'solo' ? 'Solo adventure' : 'Group trip'}{completed.has(trip.id) ? ' · Completed' : ''}</Text>
            <View style={styles.actions}>
              <AppButton label="Open trip" onPress={() => onOpen(trip.id)} />
              {!completed.has(trip.id) ? <AppButton label="Record as completed" disabled={busy} variant="secondary" onPress={() => onComplete(trip.id)} /> : null}
              {!trip.planning_started_at && trip.travel_party !== 'solo' ? <AppButton label="Manage public listing" variant="secondary" onPress={() => onManage(trip.id)} /> : null}
            </View>
          </View>
        </View>)}
      </ScrollView>
    </View>
    {trips.length > 1 ? <View style={styles.navigation}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous trip" accessibilityState={{ disabled: active === 0 }} disabled={active === 0} onPress={() => go(active - 1)} style={[styles.arrow, active === 0 && styles.disabled]}><Text style={styles.arrowText}>‹</Text></Pressable>
      <View style={styles.position}>
        {trips.length <= 7 ? <View style={styles.dots}>{trips.map((trip, i) => <View key={trip.id} style={[styles.dot, active === i && styles.activeDot]} />)}</View> : null}
        <Text accessibilityLiveRegion="polite" style={styles.hint}>{active + 1} of {trips.length} · Swipe to explore</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Next trip" accessibilityState={{ disabled: active === trips.length - 1 }} disabled={active === trips.length - 1} onPress={() => go(active + 1)} style={[styles.arrow, active === trips.length - 1 && styles.disabled]}><Text style={styles.arrowText}>›</Text></Pressable>
    </View> : null}
  </View>;
}
const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, gap: spacing.md, flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  badge: { color: colors.sky, backgroundColor: colors.surfaceTint, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, fontSize: 10, fontWeight: '800', letterSpacing: 0.6, flexShrink: 1 },
  number: { color: colors.textMuted, fontSize: typography.small },
  title: { color: colors.ink, fontSize: 24, fontWeight: '800', lineHeight: 31, marginTop: spacing.sm },
  body: { color: colors.textMuted, fontSize: typography.body, lineHeight: 23 },
  actions: { gap: spacing.md, marginTop: spacing.md },
  navigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  arrow: { width: 44, height: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  arrowText: { color: colors.sky, fontSize: 28, lineHeight: 32 },
  disabled: { opacity: 0.35 },
  position: { flex: 1, alignItems: 'center', gap: spacing.sm },
  dots: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: radius.pill, backgroundColor: colors.border },
  activeDot: { width: 20, backgroundColor: colors.sky },
  hint: { color: colors.textMuted, fontSize: typography.small, textAlign: 'center' },
});
