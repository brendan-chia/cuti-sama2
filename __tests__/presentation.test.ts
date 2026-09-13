import { estimatedDuration, placeLabel } from '@/lib/presentation';
import { buildSyntheticItinerary } from '@/domain/itinerary-planner';

test.each([
  ['japan', 'Japan'], ['tokyo tower', 'Tokyo Tower'], ['TOKYO TOWER', 'Tokyo Tower'],
  ['  tokyo   tower ', 'Tokyo Tower'], ['teamLab Planets', 'teamLab Planets'],
  ['JR Tokyo Station', 'JR Tokyo Station'], ['KLCC Park', 'KLCC Park'],
  ["McDonald's", "McDonald's"], ['東京タワー', '東京タワー'],
])('formats place name %s consistently', (input, expected) => expect(placeLabel(input)).toBe(expected));
test.each([[28, '30 min'], [43, '45 min'], [58, '1 hour'], [74, '1 hour 15 min'], [119, '2 hours']])('formats %s estimated minutes', (input, expected) => expect(estimatedDuration(Number(input))).toBe(expected));
test('draft windows use quarter hours and duration agrees with start and end', () => {
  const places = Array.from({ length: 7 }, (_, index) => ({ id: String(index), name: 'tokyo tower', category: '', description: '', latitude: 0, longitude: 0, estimatedDurationMinutes: 43 }));
  const plan = buildSyntheticItinerary({ startDate: '2027-09-13', endDate: '2027-09-13', selectedAttractions: places });
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  for (const stop of plan.days[0].stops) {
    expect(stop.estimatedVisitMinutes % 15).toBe(0);
    expect(minutes(stop.estimatedStartTime) % 15).toBe(0);
    expect(minutes(stop.estimatedEndTime) - minutes(stop.estimatedStartTime)).toBe(stop.estimatedVisitMinutes + stop.includedMealBreakMinutes);
  }
  expect(places[0].name).toBe('tokyo tower');
});
