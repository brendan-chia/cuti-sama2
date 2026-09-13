import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useReducedMotion } from '@/theme/motion';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { FlightStopIcon } from './flight-stop-icon';

const stops = [
  { label: 'Dates', icon: 0 }, { label: 'Budget', icon: 3 },
  { label: 'Wishlist', icon: 1 }, { label: 'Vote', icon: 2 },
  { label: 'Explore', icon: 4 }, { label: 'Logistics', icon: 5 }, { label: 'Itinerary', icon: 4 },
];

export function FlightPath({ stage = 0, solo = false }: { stage?: number; solo?: boolean }) {
  const visibleStops = solo ? stops.filter(stop => stop.label !== 'Vote') : stops;
  const count = visibleStops.length;
  const completed = Math.max(0, Math.min(stage, count));
  const current = Math.min(completed, count - 1);
  const landed = completed === count;
  const { fontScale } = useWindowDimensions();
  const [viewport, setViewport] = useState(0);
  const routeWidth = Math.max(viewport, count * 64 * Math.max(1, fontScale));
  const scroll = useRef<ScrollView>(null);
  const [position] = useState(() => new Animated.Value(current));
  const reduced = useReducedMotion();
  useEffect(() => {
    const animation = Animated.timing(position, {
      toValue: current, duration: reduced ? 0 : 420,
      easing: Easing.inOut(Easing.cubic), useNativeDriver: true,
    });
    animation.start();
    scroll.current?.scrollTo({ x: Math.max(0, (current + 0.5) * routeWidth / count - viewport / 2), animated: !reduced });
    return () => animation.stop();
  }, [current, position, reduced, routeWidth, count, viewport]);
  return <View style={styles.board} testID="flight-path"
    accessibilityLabel={`${completed} of ${count} stages completed. ${landed ? 'Journey complete' : 'Plane stopped at ' + visibleStops[current].label}`}>
    <View style={styles.heading}>
      <Text style={styles.kicker}>Your flight plan</Text>
      <Text style={styles.status}>{landed ? 'Landed ✓' : `Stop ${current + 1} of ${count}`}</Text>
    </View>
    <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false}
      onLayout={event => setViewport(event.nativeEvent.layout.width)}>
      <View style={[styles.route, { width: routeWidth }]}>
        <View style={[styles.dashes, { left: routeWidth / count / 2, right: routeWidth / count / 2 }]} />
        {visibleStops.map((stop, index) => <View key={stop.label} style={styles.stop}
          accessibilityLabel={`${stop.label}: ${index < completed ? 'completed' : index === current ? 'current stop' : 'upcoming'}`}>
          <View style={[styles.dot, index < completed && styles.done, !landed && index === current && styles.current]}>
            <FlightStopIcon index={stop.icon} />
            {index < completed ? <View style={styles.completed}><Text style={styles.completedText}>✓</Text></View> : null}
          </View>
          <Text style={[styles.label, index <= current && styles.activeLabel]}>{stop.label}</Text>
        </View>)}
        {viewport > 0 && !landed ? <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          style={[styles.plane, { left: routeWidth / (count * 2) - 17, transform: [{ translateX: position.interpolate({ inputRange: [0, count - 1], outputRange: [0, routeWidth * (count - 1) / count] }) }] }]}>
          <Text style={styles.planeGlyph}>✈</Text>
        </Animated.View> : null}
      </View>
    </ScrollView>
    {viewport > 0 && routeWidth > viewport + 1 ? <Text style={styles.hint}>Swipe to see every stop →</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  board: { backgroundColor: colors.surfaceTint, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  heading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm },
  kicker: { color: colors.ink, fontSize: typography.small, fontWeight: '700' },
  status: { color: colors.sky, fontSize: typography.small, fontWeight: '700' },
  route: { flexDirection: 'row', paddingTop: 32, paddingBottom: spacing.sm },
  dashes: { position: 'absolute', top: 50, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.sky },
  stop: { flex: 1, alignItems: 'center', gap: spacing.sm },
  dot: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  current: { borderColor: colors.sky, backgroundColor: colors.leafSurface },
  done: { borderColor: colors.leafSurface, backgroundColor: colors.leafSurface },
  completed: { position: 'absolute', bottom: -3, right: -3, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.sky, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.paper },
  completedText: { color: colors.paper, fontSize: 12, fontWeight: '800' },
  label: { color: colors.textMuted, fontSize: 12, lineHeight: 18, fontWeight: '600', textAlign: 'center' },
  activeLabel: { color: colors.sky, fontWeight: '700' },
  plane: { position: 'absolute', top: 0, width: 34, height: 28, alignItems: 'center', justifyContent: 'center' },
  planeGlyph: { color: colors.sky, fontSize: 26 },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: spacing.xs },
});
