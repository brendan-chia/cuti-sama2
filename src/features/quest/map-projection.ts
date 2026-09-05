export type MapPoint = { x: number; y: number };
export type MapPosition = { latitude: number; longitude: number; zoom: number };
export type MapTile = { key: string; x: number; y: number; left: number; top: number };

export const TILE_SIZE = 256;
export const MIN_MAP_ZOOM = 2;
export const MAX_MAP_ZOOM = 16;
const MAX_LATITUDE = 85.05112878;
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

/** Web Mercator world pixels, matching standard XYZ raster map tiles. */
export function project(latitude: number, longitude: number, zoom: number): MapPoint {
  const size = TILE_SIZE * 2 ** zoom;
  const sine = Math.sin(clamp(latitude, -MAX_LATITUDE, MAX_LATITUDE) * Math.PI / 180);
  return {
    x: (longitude + 180) / 360 * size,
    y: clamp((0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * size, 0, size),
  };
}

export function unproject(point: MapPoint, zoom: number): MapPosition {
  const size = TILE_SIZE * 2 ** zoom;
  const x = ((point.x % size) + size) % size;
  const y = clamp(point.y, 0, size);
  return { latitude: Math.atan(Math.sinh(Math.PI * (1 - 2 * y / size))) * 180 / Math.PI, longitude: x / size * 360 - 180, zoom };
}

export function panMap(position: MapPosition, dx: number, dy: number): MapPosition {
  const center = project(position.latitude, position.longitude, position.zoom);
  return unproject({ x: center.x - dx, y: center.y - dy }, position.zoom);
}

export function markerPosition(latitude: number, longitude: number, viewport: MapPosition, width: number, height: number): MapPoint {
  const point = project(latitude, longitude, viewport.zoom);
  const center = project(viewport.latitude, viewport.longitude, viewport.zoom);
  const worldSize = TILE_SIZE * 2 ** viewport.zoom;
  let dx = point.x - center.x;
  // Use the nearest copy when the viewport crosses the antimeridian.
  dx -= Math.round(dx / worldSize) * worldSize;
  return { x: width / 2 + dx, y: height / 2 + point.y - center.y };
}

/** Only the currently visible tiles; never prefetch a country or zoom stack. */
export function visibleTiles(viewport: MapPosition, width: number, height: number): MapTile[] {
  if (width <= 0 || height <= 0) return [];
  const center = project(viewport.latitude, viewport.longitude, viewport.zoom);
  const left = center.x - width / 2;
  const top = center.y - height / 2;
  const count = 2 ** viewport.zoom;
  const tiles: MapTile[] = [];
  for (let y = Math.max(0, Math.floor(top / TILE_SIZE)); y <= Math.min(count - 1, Math.ceil((top + height) / TILE_SIZE) - 1); y++) {
    for (let x = Math.floor(left / TILE_SIZE); x <= Math.ceil((left + width) / TILE_SIZE) - 1; x++) {
      const wrappedX = ((x % count) + count) % count;
      tiles.push({ key: `${viewport.zoom}/${x}/${y}`, x: wrappedX, y, left: x * TILE_SIZE - left, top: y * TILE_SIZE - top });
    }
  }
  return tiles;
}
