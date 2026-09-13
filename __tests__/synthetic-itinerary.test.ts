import { buildSyntheticItinerary } from '@/domain/itinerary-planner';
test('includes missing-metadata and distant stops once without excluding them', () => {
  const places = [
    { id: 'lake', name: 'Lake', category: 'Saved place', description: '', latitude: 9, longitude: 99 },
    { id: 'park', name: 'Park', category: 'Saved place', description: '', latitude: 17, longitude: 100, requiresSpecialPlanning: true },
    { id: 'unknown', name: 'Unknown', category: 'Saved place', description: '', latitude: NaN, longitude: NaN },
  ];
  const plan = buildSyntheticItinerary({ startDate: '2027-09-13', endDate: '2027-09-15', selectedAttractions: places });
  expect(plan.days.flatMap(day => day.stops.map(stop => stop.attractionId)).sort()).toEqual(['lake', 'park', 'unknown']);
  expect(plan.days[0].stops.map(stop => stop.attractionId)).toEqual(['lake']);
  expect(plan.unscheduledAttractionIds).toEqual([]);
  expect(plan.days[0].stops[0].estimatedVisitMinutes).toBe(120);
});
test('keeps an overfull single-day draft within daytime suggested windows', () => {
  const places = Array.from({ length: 20 }, (_, index) => ({ id: String(index), name: String(index), category: '', description: '', latitude: 0, longitude: 0 }));
  const plan = buildSyntheticItinerary({ startDate: '2027-09-13', endDate: '2027-09-13', selectedAttractions: places });
  expect(plan.days[0].stops).toHaveLength(20);
  expect(plan.days[0].stops.every(stop => stop.estimatedEndTime < '19:00')).toBe(true);
});

test('packs nearby activities into fuller early days instead of spreading them across the trip', () => {
  const places = Array.from({ length: 6 }, (_, i) => ({ id: String(i), name: 'Stop', category: '', description: '', latitude: 35 + i * 0.001, longitude: 139, estimatedDurationMinutes: 120 }));
  const plan = buildSyntheticItinerary({ startDate: '2027-09-13', endDate: '2027-09-20', selectedAttractions: places });
  expect(plan.days.map(day => day.stops.length)).toEqual([3, 3, 0, 0, 0, 0, 0, 0]);
  expect(plan.days[0].estimatedScheduledMinutes).toBe(480);
  expect(plan.days.flatMap(day => day.stops)).toHaveLength(6);
});