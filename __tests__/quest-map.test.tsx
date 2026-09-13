import { fireEvent, render, screen } from '@testing-library/react-native';

import { countries, countryByCode, searchCountries } from '../packages/contracts/src/countries';
import { AttractionMap } from '@/features/quest/attraction-map';
import { markerPosition, panMap, project, unproject, visibleTiles } from '@/features/quest/map-projection';

jest.mock('expo-image', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return { Image: (props: object) => React.createElement(View, props) };
});

describe('country map geography', () => {
  it('projects the equator and clamps polar coordinates into valid map pixels', () => {
    expect(project(0, 0, 2)).toEqual({ x: 512, y: 512 });
    expect(project(90, 0, 2).y).toBe(0);
    expect(project(-90, 0, 2).y).toBe(1024);
  });

  it('preserves real attraction locations through projection and inverse projection', () => {
    for (const attraction of countries.flatMap((country) => country.attractions)) {
      const restored = unproject(project(attraction.latitude, attraction.longitude, 12), 12);
      expect(restored.latitude).toBeCloseTo(attraction.latitude, 6);
      expect(restored.longitude).toBeCloseTo(attraction.longitude, 6);
    }
  });

  it('keeps pins and visible tile URLs together while crossing the antimeridian', () => {
    const viewport = { latitude: 0, longitude: 179, zoom: 2 };
    const marker = markerPosition(0, -179, viewport, 320, 310);
    expect(marker.x).toBeGreaterThan(160);
    expect(marker.x).toBeLessThan(170);
    expect(marker.y).toBe(155);
    const tiles = visibleTiles(viewport, 320, 310);
    expect(tiles.some((tile) => tile.x === 0)).toBe(true);
    expect(tiles.every((tile) => tile.x >= 0 && tile.x < 4 && tile.y >= 0 && tile.y < 4)).toBe(true);
  });

  it('requests only tiles that intersect the viewport', () => {
    expect(visibleTiles({ latitude: 0, longitude: 0, zoom: 2 }, 0, 310)).toEqual([]);
    const tiles = visibleTiles({ latitude: 0, longitude: 0, zoom: 2 }, 256, 256);
    expect(tiles).toHaveLength(4);
    expect(tiles.every((tile) => tile.left < 256 && tile.left + 256 > 0 && tile.top < 256 && tile.top + 256 > 0)).toBe(true);
  });

  it('moves the viewport west when the user drags the map east', () => {
    const panned = panMap({ latitude: 0, longitude: 0, zoom: 2 }, 256, 0);
    expect(panned.longitude).toBe(-90);
    expect(panned.latitude).toBe(0);
  });

  it('gives every country a balanced catalog with contemporary options', () => {
    const ids = countries.flatMap((country) => country.attractions.map((attraction) => attraction.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(countries).toHaveLength(24);
    for (const country of countries) {
      expect(country.attractions.length).toBeGreaterThanOrEqual(5);
      expect(country.attractions.slice(0, 2).every(attraction => !['History', 'Culture'].includes(attraction.category))).toBe(true);
      expect(country.attractions.every(attraction => attraction.sourceUrl?.startsWith('https://'))).toBe(true);
      expect(country.attractions.every((attraction) => attraction.id.startsWith(`${country.code.toLowerCase()}-`))).toBe(true);
    }
    expect(countryByCode(null)).toBeUndefined();
    expect(countryByCode('jp')?.name).toBe('Japan');
  });

  it.each([['Turkey', 'TR'], ['turkiye', 'TR'], ['U.K.', 'GB'], ['USA', 'US'], ['UAE', 'AE'], ['JP', 'JP']])('finds a country using the common name or code %s', (query, code) => {
    expect(searchCountries(query).map((country) => country.code)).toContain(code);
  });
});

describe('attraction map accessible selection', () => {
  const country = countryByCode('JP')!;

  it('lets a traveller collect an attraction through the list without loading map tiles', async () => {
    const onToggle = jest.fn();
    await render(<AttractionMap country={country} selectedIds={[]} onToggle={onToggle} />);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Fushimi Inari Taisha, Culture' }));
    expect(onToggle).toHaveBeenCalledWith('jp-fushimi-inari');
    expect(screen.getByRole('button', { name: 'Locate Fushimi Inari Taisha on map' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Map data copyright OpenStreetMap contributors' })).toBeTruthy();
  });

  it('shows saved choices and prevents edits when the stage is locked', async () => {
    const onToggle = jest.fn();
    await render(<AttractionMap country={country} selectedIds={['jp-fushimi-inari']} onToggle={onToggle} disabled />);
    const choice = screen.getByRole('checkbox', { name: 'Fushimi Inari Taisha, Culture' });
    expect(choice.props.accessibilityState).toEqual({ checked: true, disabled: true });
    await fireEvent.press(choice);
    expect(onToggle).not.toHaveBeenCalled();
    expect(screen.getByText(`1/${country.attractions.length}`)).toBeTruthy();
    expect(screen.getByText('Drag to explore · locate a place below')).toBeTruthy();
  });

  it('selects an actual geographic pin after measuring the viewport', async () => {
    const onToggle = jest.fn();
    await render(<AttractionMap country={country} selectedIds={[]} onToggle={onToggle} />);
    await fireEvent(screen.getByTestId('country-map-viewport'), 'layout', { nativeEvent: { layout: { width: 328, height: 310 } } });
    await fireEvent.press(screen.getByRole('checkbox', { name: `Fushimi Inari Taisha, map pin ${country.attractions.findIndex(place => place.id === 'jp-fushimi-inari') + 1}` }));
    expect(onToggle).toHaveBeenCalledWith('jp-fushimi-inari');
    expect(screen.getAllByTestId(/^country-map-tile-/).length).toBeLessThanOrEqual(9);
  });

  it('offers a usable list and retry after map tiles fail', async () => {
    const onToggle = jest.fn();
    await render(<AttractionMap country={country} selectedIds={[]} onToggle={onToggle} />);
    await fireEvent(screen.getByTestId('country-map-viewport'), 'layout', { nativeEvent: { layout: { width: 328, height: 310 } } });
    for (const tile of screen.getAllByTestId(/^country-map-tile-/)) await fireEvent(tile, 'error');
    expect(screen.getByText('Map unavailable')).toBeTruthy();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Fushimi Inari Taisha, Culture' }));
    expect(onToggle).toHaveBeenCalledWith('jp-fushimi-inari');
    await fireEvent.press(screen.getByRole('button', { name: 'Retry map' }));
    expect(screen.queryByText('Map unavailable')).toBeNull();
    expect(screen.getByText('Loading map…')).toBeTruthy();
  });
});

test('keeps place details expandable without changing the selection', async () => {
  const country = countryByCode('JP')!;
  const onToggle = jest.fn();
  await render(<AttractionMap country={{ ...country, attractions: [{ ...country.attractions[0], name: 'tokyo tower', description: 'A full description available on demand.' }] }} selectedIds={[]} onToggle={onToggle} />);
  expect(screen.getByText('Tokyo Tower')).toBeTruthy();
  expect(screen.queryByText('A full description available on demand.')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Details for Tokyo Tower'));
  expect(screen.getByText('A full description available on demand.')).toBeTruthy();
  expect(onToggle).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText('Details for Tokyo Tower'));
  expect(screen.queryByText('A full description available on demand.')).toBeNull();
});