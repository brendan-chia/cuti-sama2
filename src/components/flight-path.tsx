import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from '@/theme/motion';
import { colors } from '@/theme/tokens';
import { FlightStopIcon } from './flight-stop-icon';

const stops = ['Dates', 'Wishlist', 'Vote', 'Explore', 'Budget', 'Logistics'];
export function FlightPath({ stage = 0, solo = false }: { stage?: number; solo?: boolean }) {
  const visibleStops = solo ? stops.filter(label => label !== 'Vote') : stops;
  const last = visibleStops.length - 1;
  const [width, setWidth] = useState(0);
  const [position] = useState(() => new Animated.Value(Math.min(stage, last)));
  const reduced = useReducedMotion();
  useEffect(() => {
    const animation = Animated.timing(position, { toValue: Math.min(stage, last), duration: reduced ? 0 : 850, easing: Easing.inOut(Easing.cubic), useNativeDriver: true });
    animation.start(); return () => animation.stop();
  }, [position, reduced, stage, last]);
  return <View style={styles.board} accessibilityLabel={`${stage} of ${visibleStops.length} stages completed. ${stage === visibleStops.length ? 'Journey complete' : `Plane stopped at ${visibleStops[stage]}`}`} testID="flight-path">
    <View style={styles.heading}><Text style={styles.kicker}>YOUR FLIGHT PLAN</Text><Text style={styles.status}>{stage === visibleStops.length ? 'LANDED ✓' : `STOP 0${stage + 1} / 0${visibleStops.length}`}</Text></View>
    <View style={styles.route} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <View style={styles.dashes} />
      {visibleStops.map((label, index) => <View key={label} style={styles.stop}>
        <View style={[styles.dot, index === stage && styles.current]}>
          <FlightStopIcon index={stops.indexOf(label)} />
          {index < stage ? <View style={styles.completed}><Text style={styles.completedText}>✓</Text></View> : null}
        </View>
        <Text style={[styles.label, index === Math.min(stage, last) && styles.activeLabel]}>{label}</Text>
      </View>)}
      {width > 0 ? <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.plane, { left: width / (visibleStops.length * 2) - 17, transform: [{ translateX: position.interpolate({ inputRange: [0, last], outputRange: [0, width * last / visibleStops.length] }) }] }]}><Text style={styles.planeGlyph}>✈</Text></Animated.View> : null}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  board: { backgroundColor: colors.surface, borderRadius: 22, paddingHorizontal: 12, paddingTop: 14, paddingBottom: 12, borderWidth: 1, borderColor: colors.border },
  heading: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  kicker: { color: colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1.4 }, status: { color: colors.sky, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  route: { height: 100, flexDirection: 'row', paddingTop: 30 },
  dashes: { position: 'absolute', left: '10%', right: '10%', top: 52, borderTopWidth: 2, borderStyle: 'dashed', borderColor: colors.border },
  stop: { flex: 1, alignItems: 'center', gap: 8 }, dot: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: colors.surface, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  current: { borderColor: colors.sky },
  completed: { position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.sky, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.paper },
  completedText: { color: colors.paper, fontSize: 10, fontWeight: '900' }, label: { color: colors.textMuted, fontSize: 10, fontWeight: '600' }, activeLabel: { color: colors.ink, fontWeight: '900' },
  plane: { position: 'absolute', top: 0, width: 34, height: 30, alignItems: 'center', justifyContent: 'center' }, planeGlyph: { color: colors.sky, fontSize: 29, transform: [{ rotate: '-12deg' }] },
});
