import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Attraction, Country } from '../../../packages/contracts/src/countries';
import { MAX_MAP_ZOOM, MIN_MAP_ZOOM, TILE_SIZE, markerPosition, panMap, visibleTiles, type MapPosition } from './map-projection';
import { colors, radius, spacing, typography } from '@/theme/tokens';

type Props = { country: Country; selectedIds: string[]; onToggle: (id: string) => void; disabled?: boolean };
const MAP_HEIGHT = 310;
const TILE_SERVER = 'https://tile.openstreetmap.org';
const tileHeaders = Platform.OS === 'web' ? undefined : { 'User-Agent': 'CutiSama2/1.0 (group-trip-planner)' };

/** Uses visible OSM tiles only, with Expo Image disk caching and permanent map attribution.
 * Policy: https://operations.osmfoundation.org/policies/tiles/
 * Native SDWebImage's default disk retention is seven days; Glide keeps disk entries until eviction.
 * Browsers use their normal HTTP cache and Referer, with no custom request headers.
 */
export function AttractionMap(props: Props) {
  // A new country resets the map without retaining tiles or a previous country's viewport.
  return <CountryAttractionMap key={props.country.code} {...props} />;
}

function CountryAttractionMap({ country, selectedIds, onToggle, disabled = false }: Props) {
  const initialPosition = { latitude: country.latitude, longitude: country.longitude, zoom: country.zoom };
  const [viewport, setViewport] = useState<MapPosition>(initialPosition);
  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [tileStatus, setTileStatus] = useState<Record<string, 'loaded' | 'error'>>({});
  const [retry, setRetry] = useState(0);
  const [linkError, setLinkError] = useState<string | null>(null);
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dx) + Math.abs(gesture.dy) > 8,
    onPanResponderMove: (_, gesture) => setDrag({ x: gesture.dx, y: gesture.dy }),
    onPanResponderRelease: (_, gesture) => {
      setViewport((current) => panMap(current, gesture.dx, gesture.dy));
      setDrag({ x: 0, y: 0 });
    },
    onPanResponderTerminate: () => setDrag({ x: 0, y: 0 }),
  }), []);
  const tiles = useMemo(() => visibleTiles(viewport, width, MAP_HEIGHT), [viewport, width]);
  const statusKey = (key: string) => `${retry}:${key}`;
  const pending = tiles.some((tile) => !tileStatus[statusKey(tile.key)]);
  const hasError = tiles.some((tile) => tileStatus[statusKey(tile.key)] === 'error');
  const allFailed = tiles.length > 0 && tiles.every((tile) => tileStatus[statusKey(tile.key)] === 'error');
  const selectedCount = country.attractions.filter((attraction) => selectedIds.includes(attraction.id)).length;

  function reportTile(key: string, status: 'loaded' | 'error') {
    setTileStatus((current) => current[key] === status ? current : { ...current, [key]: status });
  }
  function zoomBy(delta: number) {
    setViewport((current) => ({ ...current, zoom: Math.min(MAX_MAP_ZOOM, Math.max(MIN_MAP_ZOOM, current.zoom + delta)) }));
  }
  function locate(attraction: Attraction) {
    setViewport({ latitude: attraction.latitude, longitude: attraction.longitude, zoom: Math.max(viewport.zoom, 11) });
  }
  async function openLink(url: string) {
    setLinkError(null);
    try { await Linking.openURL(url); }
    catch { setLinkError('Could not open the map link. Please try again.'); }
  }

  return <View style={styles.container} testID="attraction-map">
    <View style={styles.legend}>
      <Text style={styles.mapHint}>{disabled ? 'Drag to explore · locate a place below' : 'Drag to explore · tap a pin to collect'}</Text>
      <Text style={styles.collectionCount}>{selectedCount}/{country.attractions.length}</Text>
    </View>
    <View style={styles.map} testID="country-map-viewport" onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} testID="country-map-canvas">
        <View style={[StyleSheet.absoluteFill, { transform: [{ translateX: drag.x }, { translateY: drag.y }] }]}>
          {tiles.map((tile) => <Image
            key={statusKey(tile.key)}
            testID={`country-map-tile-${tile.key}`}
            source={{ uri: `${TILE_SERVER}/${viewport.zoom}/${tile.x}/${tile.y}.png`, headers: tileHeaders }}
            style={{ position: 'absolute', left: tile.left, top: tile.top, width: TILE_SIZE, height: TILE_SIZE }}
            contentFit="fill" cachePolicy="memory-disk" transition={0} draggable={false} accessible={false}
            onLoad={() => reportTile(statusKey(tile.key), 'loaded')}
            onError={() => reportTile(statusKey(tile.key), 'error')}
          />)}
          {width > 0 && country.attractions.map((attraction, index) => {
            const point = markerPosition(attraction.latitude, attraction.longitude, viewport, width, MAP_HEIGHT);
            if (point.x + drag.x < -30 || point.x + drag.x > width + 30 || point.y + drag.y < -30 || point.y + drag.y > MAP_HEIGHT + 30) return null;
            const selected = selectedIds.includes(attraction.id);
            return <Pressable
              key={attraction.id} testID={`map-pin-${attraction.id}`}
              accessibilityRole="checkbox" accessibilityLabel={`${attraction.name}, map pin ${index + 1}`}
              accessibilityState={{ checked: selected, disabled }} accessibilityHint="Adds or removes this attraction from your collection."
              disabled={disabled} onPress={() => onToggle(attraction.id)} hitSlop={6}
              style={[styles.pin, selected && styles.pinSelected, { left: point.x - 20, top: point.y - 40 }]}
            ><Text style={[styles.pinText, selected && styles.pinTextSelected]}>{selected ? '✓' : index + 1}</Text><View style={[styles.pinTail, selected && styles.pinTailSelected]} /></Pressable>;
          })}
        </View>
      </View>
      {pending && <View pointerEvents="none" style={styles.loading}><ActivityIndicator size="small" color={colors.background} /><Text style={styles.loadingText}>Loading map…</Text></View>}
      {allFailed && <View pointerEvents="none" style={styles.mapUnavailable}><Text style={styles.unavailableTitle}>Map unavailable</Text><Text style={styles.unavailableBody}>You can still collect places below.</Text></View>}
      <View style={styles.mapControls}>
        <Pressable accessibilityRole="button" accessibilityLabel="Zoom in on country map" accessibilityState={{ disabled: viewport.zoom >= MAX_MAP_ZOOM }} disabled={viewport.zoom >= MAX_MAP_ZOOM} onPress={() => zoomBy(1)} style={styles.mapControl}><Text style={styles.controlText}>+</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Zoom out on country map" accessibilityState={{ disabled: viewport.zoom <= MIN_MAP_ZOOM }} disabled={viewport.zoom <= MIN_MAP_ZOOM} onPress={() => zoomBy(-1)} style={styles.mapControl}><Text style={styles.controlText}>−</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Reset map to ${country.name} overview`} onPress={() => setViewport(initialPosition)} style={styles.mapControl}><Text style={styles.recenterText}>↺</Text></Pressable>
      </View>
      <Pressable accessibilityRole="link" accessibilityLabel="Map data copyright OpenStreetMap contributors" onPress={() => void openLink('https://www.openstreetmap.org/copyright')} style={styles.attribution}><Text style={styles.attributionText}>© OpenStreetMap contributors</Text></Pressable>
    </View>
    {hasError && <View style={styles.errorRow}><Text accessibilityRole="alert" style={styles.errorText}>Some map tiles could not load. The places below are still available.</Text><Pressable accessibilityRole="button" onPress={() => setRetry((current) => current + 1)} style={styles.retryButton}><Text style={styles.retryText}>Retry map</Text></Pressable></View>}
    {linkError && <Text accessibilityRole="alert" style={styles.errorText}>{linkError}</Text>}
    <View style={styles.list}>
      {country.attractions.map((attraction, index) => {
        const selected = selectedIds.includes(attraction.id);
        return <View key={attraction.id} style={[styles.attractionRow, selected && styles.attractionRowSelected]}>
          <Pressable accessibilityRole="checkbox" accessibilityLabel={`${attraction.name}, ${attraction.category}`} accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={() => onToggle(attraction.id)} style={styles.attractionChoice} testID={`attraction-${attraction.id}`}>
            <View style={[styles.listNumber, selected && styles.listNumberSelected]}><Text style={[styles.numberText, selected && styles.numberTextSelected]}>{selected ? '✓' : index + 1}</Text></View>
            <View style={styles.attractionCopy}><Text style={styles.category}>{attraction.category.toUpperCase()}</Text><Text style={styles.attractionName}>{attraction.name}</Text><Text style={styles.description}>{attraction.description}</Text></View>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Locate ${attraction.name} on map`} onPress={() => locate(attraction)} style={styles.locateButton}><Text style={styles.locateText}>Locate ↗</Text></Pressable>
        </View>;
      })}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  mapHint: { color: colors.textMuted, fontSize: typography.small, flex: 1 },
  collectionCount: { color: colors.sky, fontSize: typography.small, fontWeight: '800' },
  map: { height: MAP_HEIGHT, width: '100%', backgroundColor: colors.sand, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  mapControls: { position: 'absolute', right: spacing.sm, top: spacing.sm, gap: spacing.xs },
  mapControl: { backgroundColor: colors.paper, borderWidth: 1, borderColor: '#D5D8C9', borderRadius: radius.sm, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  controlText: { color: colors.ink, fontSize: 27, lineHeight: 30, fontWeight: '600' },
  recenterText: { color: colors.ink, fontSize: 26 },
  attribution: { position: 'absolute', bottom: 0, right: 0, backgroundColor: colors.paper, minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  attributionText: { fontSize: 10, color: colors.ink, textDecorationLine: 'underline' },
  pin: { position: 'absolute', width: 40, height: 40, backgroundColor: colors.coral, borderColor: colors.ink, borderWidth: 2, borderRadius: 20, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  pinSelected: { backgroundColor: colors.sky, zIndex: 2 },
  pinText: { fontSize: 16, fontWeight: '900', color: colors.background },
  pinTextSelected: { color: colors.paper },
  pinTail: { position: 'absolute', bottom: -5, width: 9, height: 9, backgroundColor: colors.coral, transform: [{ rotate: '45deg' }] },
  pinTailSelected: { backgroundColor: colors.sky },
  loading: { position: 'absolute', left: spacing.sm, top: spacing.sm, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.sm, padding: spacing.sm },
  loadingText: { color: colors.ink, fontSize: typography.small },
  mapUnavailable: { position: 'absolute', left: 20, right: 62, top: 130, backgroundColor: colors.sand, padding: spacing.md, borderRadius: radius.sm },
  unavailableTitle: { color: colors.ink, fontSize: typography.body, fontWeight: '800' },
  unavailableBody: { color: colors.ink, fontSize: typography.small, lineHeight: 18, marginTop: spacing.xs },
  errorRow: { gap: spacing.sm, alignItems: 'flex-start' },
  errorText: { color: colors.textMuted, fontSize: typography.small, lineHeight: 18 },
  retryButton: { paddingVertical: spacing.sm, paddingRight: spacing.md, minHeight: 44, justifyContent: 'center' },
  retryText: { color: colors.sky, fontSize: typography.small, fontWeight: '800' },
  list: { gap: spacing.sm },
  attractionRow: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.sm },
  attractionRowSelected: { borderBottomColor: colors.sky },
  attractionChoice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.sm },
  listNumber: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 18, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  listNumberSelected: { backgroundColor: colors.sky, borderColor: colors.sky },
  numberText: { color: colors.ink, fontSize: typography.body, fontWeight: '800' },
  numberTextSelected: { color: colors.background },
  attractionCopy: { flex: 1, gap: spacing.xs },
  category: { color: colors.coral, fontSize: typography.label, fontWeight: '800', letterSpacing: 1 },
  attractionName: { color: colors.ink, fontSize: typography.body, fontWeight: '800' },
  description: { color: colors.textMuted, fontSize: typography.small, lineHeight: 19 },
  locateButton: { alignSelf: 'flex-start', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginLeft: 36, minHeight: 44, justifyContent: 'center' },
  locateText: { color: colors.sky, fontSize: typography.small, fontWeight: '700' },
});
