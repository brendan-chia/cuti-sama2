import { countryByCode } from '../../../packages/contracts/src/countries.ts';
import { QuestRoomSchema } from '../../../packages/contracts/src/quest.ts';
import { emptyLogistics, logisticsTotals } from '../../../packages/contracts/src/logistics.ts';
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
  const saved = room.logistics ?? emptyLogistics;
  const totals = logisticsTotals(saved, room.members.map((member) => member.memberId), room.budgetSummary.crewHardCeiling);
  if (totals.remaining < 0) throw new Error('Transport and accommodation exceed the group budget. Review Logistics.');
  const journeys = saved.transport.filter((item) => item.status !== 'proposed' && room.members.some((member) => member.memberId === item.memberId))
    .sort((a, b) => a.memberId.localeCompare(b.memberId) || a.direction.localeCompare(b.direction));
  const arrivals = journeys.filter((item) => item.direction === 'arrival').map((item) => ({ memberId: item.memberId, mode: item.mode, arrivalAt: item.arrivalAt, arrivalLocation: item.arrivalLocation, cost: item.cost }));
  const departures = journeys.filter((item) => item.direction === 'departure').map((item) => ({ memberId: item.memberId, mode: item.mode, departureAt: item.departureAt, departureLocation: item.departureLocation, cost: item.cost }));
  const groupArrivalAt = arrivals.length ? new Date(Math.max(...arrivals.map((item) => Date.parse(item.arrivalAt)))).toISOString() : null;
  const groupDepartureAt = departures.length ? new Date(Math.min(...departures.map((item) => Date.parse(item.departureAt)))).toISOString() : null;
  if (groupArrivalAt && groupDepartureAt && groupArrivalAt >= groupDepartureAt) throw new Error('The group has no shared time between arrivals and departures.');
  return {
    questRevision: room.revision,
    destination: { name: country.name, country: country.name },
    dates: { startsOn: room.period.startsOn, endsOn: room.period.endsOn }, dayCount,
    travellerCount: room.members.length, selectedPlaces,
    logistics: { arrivals, departures, groupArrivalAt, groupDepartureAt, draft: totals.draft,
      accommodation: totals.stay ? { name: totals.stay.name, location: { name: totals.stay.area, latitude: totals.stay.latitude, longitude: totals.stay.longitude }, checkIn: totals.stay.checkIn, checkOut: totals.stay.checkOut, totalCost: totals.stay.totalCost } : null,
      budget: { wholeTripPerPerson: room.budgetSummary.crewHardCeiling, accommodationPerPerson: totals.stayPerPerson,
        averageTransportPerPerson: totals.averageTransport, remainingPerPerson: totals.remaining, currency: 'MYR' },
    },
    hardConstraints: { budgetMaximum: totals.remaining, currency: room.budgetSummary.currency,
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
  for (const day of draft.days) {
    for (const activity of day.activities) {
      try {
        const start = localInstant(day.date!, activity.timeBlock.start, activity.timeBlock.timezone);
        const end = localInstant(day.date!, activity.timeBlock.end, activity.timeBlock.timezone);
        const arrival = input.logistics.groupArrivalAt;
        const departure = input.logistics.groupDepartureAt;
        if (arrival && start < Date.parse(arrival)) issues.push('Do not schedule group activities before everyone arrives.');
        if (departure && end > Date.parse(departure)) issues.push('Do not schedule group activities after the earliest departure.');
        if (arrival && day.activities[0] === activity && start - (activity.travelMinutes ?? 0) * 60_000 < Date.parse(arrival)) issues.push('Allow travel time from arrival to the first group activity.');
        if (input.logistics.accommodation && activity.travelMinutes === null) issues.push('Include travel time from the stay or previous stop.');
      } catch { issues.push('Use a valid local activity time and IANA timezone.'); }
    }
  }
  for (const place of input.selectedPlaces) {
    const scheduled = activities.find((activity) => activity.tags.includes(`place:${place.id}`));
    if (!scheduled || scheduled.location.latitude !== place.latitude || scheduled.location.longitude !== place.longitude) {
      issues.push(`The selected stop ${place.name} must be scheduled at its saved map location.`);
    }
  }
  return issues;
}

// Resolve model wall-clock times in their named zone, never the server timezone.
function localInstant(date: string, time: string, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const target = Date.parse(`${date}T${time}:00Z`);
  let instant = target;
  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
    const wall = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00Z`);
    if (wall === target) return instant;
    instant += target - wall;
  }
  throw new Error('Invalid local time.');
}
