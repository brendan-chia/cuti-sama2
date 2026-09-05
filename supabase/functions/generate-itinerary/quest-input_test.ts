import { questItineraryInput, questItineraryConflicts } from './quest-input.ts';
import { countryByCode } from '../../../packages/contracts/src/countries.ts';
import type { AiItinerary } from '../_shared/groq.ts';

function assert(value: unknown, message = 'Assertion failed'): asserts value { if (!value) throw new Error(message); }
const room = {
  tripId: '11111111-1111-4111-8111-111111111111', tripName: 'Japan trip', currentMemberId: '22222222-2222-4222-8222-222222222222', currentRole: 'organizer',
  stage: 'complete', revision: 8, members: [{ memberId: '22222222-2222-4222-8222-222222222222', displayName: 'Private traveller name', availabilitySubmitted: true, picksSubmitted: true, votesSubmitted: true, budgetSubmitted: true }],
  ownAvailability: null, sharedAvailability: null, period: { startsOn: '2027-12-04', endsOn: '2027-12-05', label: 'Trip', reason: 'Shared dates' },
  ownPicks: ['JP'], countries: ['JP'], ownVotes: { JP: true }, results: [], tiedCountryCodes: [], selectedCountryCode: 'JP',
  attractionIds: [countryByCode('JP')!.attractions[0].id, 'osm-node-123'], ownBudget: 5000,
  budgetSummary: { submittedCount: 1, comfortablePerPerson: 5000, currency: 'MYR' },
  importedPlaces: [{ id: 'osm-node-123', name: 'Tokyo Disneyland Hotel', address: 'Urayasu, Chiba, Japan', countryCode: 'JP', latitude: 35.635, longitude: 139.88,
    evidence: 'Private social caption', sourceUrl: 'https://www.openstreetmap.org/node/123', sourcePost: 'https://www.tiktok.com/@private/video/123', confirmedBy: '22222222-2222-4222-8222-222222222222' }],
};
Deno.test('completed quest input includes selected imported stops and budget without individual data', () => {
  const input = questItineraryInput(room, '2026-09-05T10:00:00Z');
  assert(input.dayCount === 2 && input.travellerCount === 1 && input.hardConstraints.budgetMaximum === 5000);
  assert(input.selectedPlaces.length === 2 && input.selectedPlaces[1].name === 'Tokyo Disneyland Hotel');
  const text = JSON.stringify(input);
  for (const privateValue of ['Private traveller name', 'Private social caption', '@private', room.currentMemberId, 'ownVotes']) assert(!text.includes(privateValue));
  for (const invalid of [{ ...room, stage: 'budget' }, { ...room, budgetSummary: null }, { ...room, attractionIds: ['unknown'] }]) {
    let rejected = false; try { questItineraryInput(invalid, '2026-09-05T10:00:00Z'); } catch { rejected = true; }
    assert(rejected);
  }
});
Deno.test('quest validation requires every date and every selected place at its verified coordinates', () => {
  const input = questItineraryInput(room, '2026-09-05T10:00:00Z');
  const draft = { days: input.selectedPlaces.map((place, index) => ({ date: `2027-12-0${4 + index}`, activities: [{ tags: [`place:${place.id}`], location: { latitude: place.latitude, longitude: place.longitude } }] })) } as AiItinerary;
  assert(questItineraryConflicts(draft, input).length === 0);
  assert(questItineraryConflicts({ ...draft, days: draft.days.slice(0, 1) }, input).length === 2);
  draft.days[1].activities[0].location.latitude = 0;
  assert(questItineraryConflicts(draft, input).length === 1);
});
