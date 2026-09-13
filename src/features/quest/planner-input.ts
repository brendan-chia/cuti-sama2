import { countryByCode, type Attraction } from '../../../packages/contracts/src/countries';
import type { QuestRoom } from '../../../packages/contracts/src/quest';
import { buildSyntheticItinerary } from '@/domain/itinerary-planner';

export function questPlaces(room: QuestRoom): Attraction[] {
  return [
    ...(countryByCode(room.selectedCountryCode)?.attractions ?? []),
    ...(room.importedPlaces ?? []).filter(place => place.countryCode === room.selectedCountryCode).map(place => ({
      ...place, countryId: place.countryCode, category: 'Saved place', description: place.address,
    })),
  ];
}
export function planQuest(room: QuestRoom) {
  if (!room.period) throw new Error('Lock the trip dates before building an itinerary.');
  const places = questPlaces(room);
  const byId = new Map(places.map(place => [place.id, place]));
  // Retain every saved selection in the suggested outline.
  const selectedAttractions = room.attractionIds.map(id => byId.get(id) ?? ({
    id, name: id, category: 'Unavailable place', description: '', latitude: NaN, longitude: NaN,
  }));
  return buildSyntheticItinerary({
    startDate: room.period.startsOn, endDate: room.period.endsOn,
    selectedAttractions, groupBudgetCeilingMYR: room.budgetSummary?.crewHardCeiling,
    groupVibes: room.groupVibes ?? [],
  });
}
