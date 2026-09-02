import { diffItineraries } from '@/domain/itinerary-diff';
import { validItinerary } from './itinerary-contract.test';

describe('semantic itinerary diff', () => {
  it('ignores structurally equal days', () => {
    expect(diffItineraries(validItinerary, structuredClone(validItinerary)).changedDays).toEqual([]);
  });

  it('reports changed activities and recalculates day and trip estimates', () => {
    const revised = structuredClone(validItinerary);
    revised.days[0].activities[0].title = 'Quiet museum visit';
    revised.days[0].activities[0].estimate.maximum = 18;
    const result = diffItineraries(validItinerary, revised);
    expect(result.changedDays).toHaveLength(1);
    expect(result.changedDays[0]).toMatchObject({ dayNumber: 1, activityChanges: [{ activityId: 'heritage-walk', change: 'changed' }] });
    expect(result.beforeEstimate.maximum).toBe(30);
    expect(result.afterEstimate.maximum).toBe(18);
  });

  it('treats activity identity as semantic even when its order changes', () => {
    const revised = structuredClone(validItinerary);
    revised.days[0].activities.push({ ...structuredClone(revised.days[0].activities[0]), activityId: 'lunch', title: 'Lunch', timeBlock: { start: '12:00', end: '13:00', timezone: 'Asia/Kuala_Lumpur' } });
    expect(diffItineraries(validItinerary, revised).changedDays[0].activityChanges).toEqual([expect.objectContaining({ activityId: 'lunch', change: 'added' })]);
  });
});
