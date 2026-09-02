import type { ItineraryDraft } from '../../packages/contracts/src/itinerary';
import type { ItineraryDiff } from '../../packages/contracts/src/revision';

type Activity = ItineraryDraft['days'][number]['activities'][number];
type Day = ItineraryDraft['days'][number];

function same(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function estimate(days: Day[]) {
  const activities = days.flatMap((day) => day.activities);
  const currencies = new Set(activities.map((activity) => activity.estimate.currency));
  return {
    currency: currencies.size === 1 ? [...currencies][0] : null,
    minimum: activities.reduce((total, activity) => total + activity.estimate.minimum, 0),
    maximum: activities.reduce((total, activity) => total + activity.estimate.maximum, 0),
  };
}

function activityChanges(before: Activity[], after: Activity[]) {
  const beforeById = new Map(before.map((activity) => [activity.activityId, activity]));
  const afterById = new Map(after.map((activity) => [activity.activityId, activity]));
  const ids = [...new Set([...beforeById.keys(), ...afterById.keys()])];
  return ids.flatMap((activityId) => {
    const previous = beforeById.get(activityId); const next = afterById.get(activityId);
    if (previous && next && same(previous, next)) return [];
    return [{
      activityId,
      change: !previous ? 'added' as const : !next ? 'removed' as const : 'changed' as const,
      beforeTitle: previous?.title ?? null,
      afterTitle: next?.title ?? null,
    }];
  });
}

export function diffItineraries(before: ItineraryDraft, after: ItineraryDraft): ItineraryDiff {
  const previousDays = new Map(before.days.map((day) => [day.dayNumber, day]));
  const nextDays = new Map(after.days.map((day) => [day.dayNumber, day]));
  const dayNumbers = [...new Set([...previousDays.keys(), ...nextDays.keys()])].sort((a, b) => a - b);
  const changedDays = dayNumbers.flatMap((dayNumber) => {
    const previous = previousDays.get(dayNumber); const next = nextDays.get(dayNumber);
    if (previous && next && same(previous, next)) return [];
    return [{
      dayNumber,
      change: !previous ? 'added' as const : !next ? 'removed' as const : 'changed' as const,
      activityChanges: activityChanges(previous?.activities ?? [], next?.activities ?? []),
      beforeEstimate: estimate(previous ? [previous] : []),
      afterEstimate: estimate(next ? [next] : []),
    }];
  });
  return { changedDays, beforeEstimate: estimate(before.days), afterEstimate: estimate(after.days) };
}
