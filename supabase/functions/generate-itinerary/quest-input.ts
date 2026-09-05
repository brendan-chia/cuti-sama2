import { countryByCode } from '../../../packages/contracts/src/countries.ts';
import { QuestRoomSchema } from '../../../packages/contracts/src/quest.ts';
import type { AiItinerary } from '../_shared/groq.ts';

export function questItineraryInput(value: unknown, updatedAt: string) {
  const room = QuestRoomSchema.parse(value);
  if (room.stage !== 'complete' || !room.period || !room.budgetSummary ||
      room.budgetSummary.submittedCount !== room.members.length) throw new Error('Complete the group plan before generating an itinerary.');
  const country = countryByCode(room.selectedCountryCode);
  if (!country) throw new Error('The selected country is unavailable.');
  const allPlaces = [...country.attractions, ...(room.importedPlaces ?? []).map((place) => ({
    id: place.id, name: place.name, latitude: place.latitude, longitude: place.longitude,
    description: place.address, sourceUrl: place.sourceUrl,
  }))];
  const selectedPlaces = room.attractionIds.map((id) => {
    const place = allPlaces.find((item) => item.id === id);
    if (!place) throw new Error('A selected place is unavailable. Review the group’s stops.');
    return { id: place.id, name: place.name, latitude: place.latitude, longitude: place.longitude,
      description: place.description, sourceUrl: place.sourceUrl ?? null };
  });
  const dayCount = (Date.parse(room.period.endsOn) - Date.parse(room.period.startsOn)) / 86_400_000 + 1;
  if (!selectedPlaces.length || dayCount < 1 || dayCount > 30) throw new Error('Choose places and travel dates spanning 1–30 days.');
  return {
    questRevision: room.revision,
    destination: { name: country.name, country: country.name },
    dates: { startsOn: room.period.startsOn, endsOn: room.period.endsOn }, dayCount,
    travellerCount: room.members.length, selectedPlaces,
    hardConstraints: { budgetMaximum: room.budgetSummary.comfortablePerPerson, currency: room.budgetSummary.currency,
      startsOn: room.period.startsOn, endsOn: room.period.endsOn, accessibilityRequirements: [] as string[], dealbreakers: [] as string[], maxTravelMinutes: null },
    groupSignals: selectedPlaces.map((place) => ({ kind: 'must_have', value: place.name })),
    sourceTimestamps: [updatedAt],
  };
}

export function questItineraryConflicts(draft: AiItinerary, input: ReturnType<typeof questItineraryInput>) {
  const issues: string[] = [];
  if (draft.days.length !== input.dayCount || draft.days.some((day, index) =>
    day.date !== new Date(Date.parse(input.dates.startsOn) + index * 86_400_000).toISOString().slice(0, 10))) issues.push('The itinerary must cover every confirmed travel date.');
  const activities = draft.days.flatMap((day) => day.activities);
  for (const place of input.selectedPlaces) {
    const scheduled = activities.find((activity) => activity.tags.includes(`place:${place.id}`));
    if (!scheduled || scheduled.location.latitude !== place.latitude || scheduled.location.longitude !== place.longitude) {
      issues.push(`The selected stop ${place.name} must be scheduled at its saved map location.`);
    }
  }
  return issues;
}
