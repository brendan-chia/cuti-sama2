import { findItineraryConflicts } from '@/domain/itinerary-conflicts';
import { validItinerary } from './itinerary-contract.test';

const constraints = { budgetMaximum: 100, currency: 'MYR', accessibilityRequirements: [], dealbreakers: [], maxTravelMinutes: 60 };

describe('generated itinerary hard-constraint revalidation', () => {
  it('detects cost, accessibility, dealbreaker, and travel-time conflicts', () => {
    const activity = validItinerary.days[0].activities[0];
    const draft = { ...validItinerary, days: [{ ...validItinerary.days[0], activities: [{
      ...activity, description: 'A crowded nightclub visit', travelMinutes: 120,
      estimate: { ...activity.estimate, maximum: 150 }, accessibility: { status: 'unknown' as const, features: [], notes: null },
      tags: ['nightclub'],
    }] }] };
    const result = findItineraryConflicts(draft, { ...constraints, accessibilityRequirements: ['step free'], dealbreakers: ['nightclub'] });
    expect(result.map((item) => item.category)).toEqual(expect.arrayContaining(['cost', 'accessibility', 'dealbreaker', 'travel_time']));
  });

  it('allows a conforming draft', () => expect(findItineraryConflicts(validItinerary, constraints)).toEqual([]));
});
