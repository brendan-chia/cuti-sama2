import type { ItineraryDraft } from '../../packages/contracts/src/itinerary';

export type ItineraryHardConstraints = {
  budgetMaximum: number | null;
  currency: string | null;
  accessibilityRequirements: string[];
  dealbreakers: string[];
  maxTravelMinutes: number | null;
  startsOn?: string | null;
  endsOn?: string | null;
};

export type ItineraryConflict = {
  category: 'cost' | 'accessibility' | 'dealbreaker' | 'travel_time' | 'dates';
  activityId: string | null;
  message: string;
};

const normalize = (value: string) => value.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const meaningful = (value: string) => {
  const normalized = normalize(value);
  return normalized.length > 1 && !['none', 'no', 'n a', 'no requirements'].includes(normalized);
};

export function findItineraryConflicts(draft: ItineraryDraft, constraints: ItineraryHardConstraints): ItineraryConflict[] {
  const conflicts: ItineraryConflict[] = [];
  const activities = draft.days.flatMap((day) => day.activities);

  if (constraints.budgetMaximum !== null && constraints.currency) {
    const estimates = activities.map((activity) => activity.estimate);
    if (estimates.some((estimate) => estimate.currency !== constraints.currency || estimate.basis !== 'per_person')) {
      conflicts.push({ category: 'cost', activityId: null, message: `Every estimate must use ${constraints.currency} before the group budget can be revalidated.` });
    } else {
      const maximum = estimates.reduce((total, estimate) => total + estimate.maximum, 0);
      if (maximum > constraints.budgetMaximum) conflicts.push({ category: 'cost', activityId: null, message: `Estimated maximum ${constraints.currency} ${maximum} exceeds the hard budget of ${constraints.budgetMaximum}.` });
    }
  }

  if (constraints.startsOn || constraints.endsOn) for (const day of draft.days) {
    if (!day.date || (constraints.startsOn && day.date < constraints.startsOn) || (constraints.endsOn && day.date > constraints.endsOn)) {
      conflicts.push({ category: 'dates', activityId: null, message: `Day ${day.dayNumber} falls outside the group's locked travel dates.` });
    }
  }

  const accessTerms = constraints.accessibilityRequirements.filter(meaningful).map(normalize);
  if (accessTerms.length) {
    for (const activity of activities) {
      const evidence = normalize([activity.accessibility.features.join(' '), activity.accessibility.notes ?? ''].join(' '));
      const unsupported = activity.accessibility.status !== 'confirmed' || accessTerms.some((term) => !evidence.includes(term));
      if (unsupported) conflicts.push({ category: 'accessibility', activityId: activity.activityId, message: `${activity.title} does not confirm every accessibility requirement.` });
    }
  }

  const dealbreakers = constraints.dealbreakers.filter(meaningful).map(normalize);
  for (const activity of activities) {
    const searchable = normalize([activity.title, activity.description, activity.location.name, activity.location.address ?? '', ...activity.tags].join(' '));
    const match = dealbreakers.find((term) => searchable.includes(term));
    if (match) conflicts.push({ category: 'dealbreaker', activityId: activity.activityId, message: `${activity.title} conflicts with a recorded dealbreaker.` });
    if (constraints.maxTravelMinutes !== null && activity.travelMinutes !== null && activity.travelMinutes > constraints.maxTravelMinutes) {
      conflicts.push({ category: 'travel_time', activityId: activity.activityId, message: `${activity.title} exceeds the group's maximum travel time.` });
    }
  }
  return conflicts;
}
