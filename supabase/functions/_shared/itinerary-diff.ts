import type { AiItinerary } from './groq.ts';

type Activity = AiItinerary['days'][number]['activities'][number];
type Day = AiItinerary['days'][number];
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const estimate = (days: Day[]) => {
  const activities = days.flatMap((day) => day.activities); const currencies = new Set(activities.map((activity) => activity.estimate.currency));
  return { currency: currencies.size === 1 ? [...currencies][0] : null, minimum: activities.reduce((sum, activity) => sum + activity.estimate.minimum, 0), maximum: activities.reduce((sum, activity) => sum + activity.estimate.maximum, 0) };
};
const activityChanges = (before: Activity[], after: Activity[]) => {
  const left = new Map(before.map((item) => [item.activityId, item])); const right = new Map(after.map((item) => [item.activityId, item]));
  return [...new Set([...left.keys(), ...right.keys()])].flatMap((activityId) => {
    const previous = left.get(activityId); const next = right.get(activityId); if (previous && next && same(previous, next)) return [];
    return [{ activityId, change: !previous ? 'added' : !next ? 'removed' : 'changed', beforeTitle: previous?.title ?? null, afterTitle: next?.title ?? null }];
  });
};
export function diffItineraries(before: AiItinerary, after: AiItinerary) {
  const left = new Map(before.days.map((day) => [day.dayNumber, day])); const right = new Map(after.days.map((day) => [day.dayNumber, day]));
  const changedDays = [...new Set([...left.keys(), ...right.keys()])].sort((a, b) => a - b).flatMap((dayNumber) => {
    const previous = left.get(dayNumber); const next = right.get(dayNumber); if (previous && next && same(previous, next)) return [];
    return [{ dayNumber, change: !previous ? 'added' : !next ? 'removed' : 'changed', activityChanges: activityChanges(previous?.activities ?? [], next?.activities ?? []), beforeEstimate: estimate(previous ? [previous] : []), afterEstimate: estimate(next ? [next] : []) }];
  });
  return { changedDays, beforeEstimate: estimate(before.days), afterEstimate: estimate(after.days) };
}
