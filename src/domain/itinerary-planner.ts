import { roundEstimateMinutes } from '@/lib/presentation';
import type { Attraction } from '../../packages/contracts/src/countries';
import type { TripVibe } from '../../packages/contracts/src/trip-vibe';

export const PLANNER_DEFAULTS = Object.freeze({
  dayStartMinutes: 9 * 60,
  maxScheduledMinutesPerDay: 480,
  maxStopsPerDay: 4,
  bufferMinutes: 30,
  mealBreakMinutes: 60,
  mealStartMinutes: 12 * 60,
  clusterRadiusKm: 25,
  similarDistanceKm: 2,
  maxTransferKm: 80,
  approximateSpeedKmh: 25,
  distanceMultiplier: 1.3,
  minimumTransferMinutes: 10,
  maxTripDays: 30,
});
export type PlannerConfig = { [K in keyof typeof PLANNER_DEFAULTS]: number };
export type PlannerInput = {
  startDate: string;
  endDate: string;
  selectedAttractions: readonly Attraction[];
  /** Shared ceiling is per person, like the activity allowances. */
  groupBudgetCeilingMYR?: number | null;
  /** Repeated values can represent aggregated participant votes. Never infer absent preferences. */
  groupVibes?: readonly TripVibe[];
};
export type PlannedStop = {
  attractionId: string;
  estimatedStartTime: string;
  estimatedEndTime: string;
  estimatedVisitMinutes: number;
  estimatedTravelMinutesFromPrevious: number;
  includedMealBreakMinutes: number;
};
export type PlannedDay = {
  date: string;
  stops: PlannedStop[];
  estimatedActivityCostMYR: number;
  estimatedScheduledMinutes: number;
  reservedMealBreakMinutes: number;
};
export type PlannedItinerary = {
  plannerVersion: '1.0';
  days: PlannedDay[];
  unscheduledAttractionIds: string[];
  unscheduledReasons: Record<string, string>;
  warnings: string[];
  estimatedActivityTotalMYR: number;
  costBasis: 'per_person';
  travelEstimateBasis: 'straight_line_heuristic';
};
type Point = { latitude: number; longitude: number };
const idOrder = (a: Attraction, b: Attraction) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
const money = (value: number) => Math.round(value * 100) / 100;
const time = (minutes: number) => `${Math.floor(minutes / 60).toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`;

export function haversineKm(a: Point, b: Point): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

function dateInstant(date: string) {
  const instant = Date.parse(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(instant) || new Date(instant).toISOString().slice(0, 10) !== date) {
    throw new Error('Choose valid locked trip dates.');
  }
  return instant;
}
function metadataProblem(place: Attraction): string | null {
  if (!place.countryId || !Number.isFinite(place.latitude) || Math.abs(place.latitude) > 90 ||
      !Number.isFinite(place.longitude) || Math.abs(place.longitude) > 180 ||
      !Number.isInteger(place.estimatedDurationMinutes) || place.estimatedDurationMinutes! <= 0 ||
      !Number.isFinite(place.estimatedCostMYR) || place.estimatedCostMYR! < 0) {
    return 'Visit duration, cost allowance or location metadata is missing. Review this place before scheduling.';
  }
  if (place.requiresSpecialPlanning) return 'Needs specific access, expedition or timed-visit details before scheduling.';
  return null;
}

/** Pure, bounded greedy heuristic. No network, clock, random source, input mutation or LLM. */
export function buildItinerary(input: PlannerInput, overrides: Partial<PlannerConfig> = {}): PlannedItinerary {
  const config = { ...PLANNER_DEFAULTS, ...overrides };
  for (const [key, value] of Object.entries(config)) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid planner setting: ${key}.`);
  }
  if (!Number.isInteger(config.maxStopsPerDay) || config.maxStopsPerDay < 1 ||
      !Number.isInteger(config.dayStartMinutes) || !Number.isInteger(config.maxScheduledMinutesPerDay) ||
      !Number.isInteger(config.bufferMinutes) || !Number.isInteger(config.mealBreakMinutes) ||
      !Number.isInteger(config.mealStartMinutes) || !Number.isInteger(config.minimumTransferMinutes) ||
      config.maxScheduledMinutesPerDay <= config.mealBreakMinutes || config.approximateSpeedKmh <= 0 ||
      config.distanceMultiplier < 1 || config.dayStartMinutes + config.maxScheduledMinutesPerDay >= 1440 ||
      !Number.isInteger(config.maxTripDays) || config.maxTripDays < 1 || config.maxTripDays > 366) {
    throw new Error('Planner settings must describe a bounded daytime schedule.');
  }
  const start = dateInstant(input.startDate);
  const dayCount = (dateInstant(input.endDate) - start) / 86400000 + 1;
  if (dayCount < 1 || dayCount > config.maxTripDays) throw new Error(`Choose a trip lasting 1–${config.maxTripDays} days.`);
  if (input.groupBudgetCeilingMYR != null && (!Number.isFinite(input.groupBudgetCeilingMYR) || input.groupBudgetCeilingMYR < 0)) {
    throw new Error('The group budget ceiling must be a non-negative MYR amount.');
  }
  const selected = [...input.selectedAttractions].sort(idOrder);
  if (selected.some(place => !place.id) || new Set(selected.map(p => p.id)).size !== selected.length) {
    throw new Error('Selected attractions must have unique stable IDs.');
  }
  const reasons: Record<string, string> = Object.create(null);
  let remaining = selected.filter(place => {
    const problem = metadataProblem(place);
    if (problem) reasons[place.id] = problem;
    return !problem;
  });
  const vibeScore = (place: Attraction) => (input.groupVibes ?? []).reduce((score, vibe) => score + (place.vibes?.includes(vibe) ? 1 : 0), 0);
  let previous: Attraction | undefined;
  const days: PlannedDay[] = [];
  for (let dayIndex = 0; dayIndex < dayCount; dayIndex++) {
    const day: PlannedDay = {
      date: new Date(start + dayIndex * 86400000).toISOString().slice(0, 10),
      stops: [], estimatedActivityCostMYR: 0, estimatedScheduledMinutes: 0, reservedMealBreakMinutes: 0,
    };
    // A flexible meal hour is reserved inside the daily cap, separate from visit estimates.
    // Long visit windows crossing noon include the meal break, without shortening the visit.
    let elapsed = 0;
    let mealTaken = false;
    while (day.stops.length < config.maxStopsPerDay) {
      const buffer = day.stops.length ? config.bufferMinutes : 0;
      const feasible = remaining.map(place => {
        const distance = previous ? haversineKm(previous, place) : 0;
        const travel = previous ? Math.max(config.minimumTransferMinutes, Math.ceil(distance * config.distanceMultiplier / config.approximateSpeedKmh * 60)) : 0;
        return { place, distance, travel };
      }).filter(({ place, distance, travel }) =>
        (!previous || (place.countryId === previous.countryId && distance <= config.maxTransferKm)) &&
        elapsed + buffer + travel + place.estimatedDurationMinutes! + (mealTaken ? 0 : config.mealBreakMinutes) <= config.maxScheduledMinutesPerDay);
      if (!feasible.length) break;
      if (!previous) {
        // Densest feasible local neighbourhood first; closest neighbourhood breaks density ties.
        const cluster = (place: Attraction) => feasible.map(candidate => haversineKm(place, candidate.place)).filter(distance => distance <= config.clusterRadiusKm);
        feasible.sort((a, b) => {
          const ac = cluster(a.place), bc = cluster(b.place);
          return bc.length - ac.length ||
            ac.reduce((sum, value) => sum + value, 0) - bc.reduce((sum, value) => sum + value, 0) ||
            vibeScore(b.place) - vibeScore(a.place) || idOrder(a.place, b.place);
        });
      } else {
        const nearest = Math.min(...feasible.map(candidate => candidate.distance));
        // Only candidates within 2 km of the nearest feasible choice receive a vibe tie-break.
        feasible.sort((a, b) => {
          const aNear = a.distance <= nearest + config.similarDistanceKm;
          const bNear = b.distance <= nearest + config.similarDistanceKm;
          return Number(bNear) - Number(aNear) ||
            (aNear && bNear ? vibeScore(b.place) - vibeScore(a.place) : 0) ||
            a.distance - b.distance || idOrder(a.place, b.place);
        });
      }
      const { place, travel } = feasible[0];
      elapsed += buffer + travel;
      if (!mealTaken && config.dayStartMinutes + elapsed >= config.mealStartMinutes) {
        elapsed += config.mealBreakMinutes;
        mealTaken = true;
      }
      const mealDuringVisit = !mealTaken && config.dayStartMinutes + elapsed + place.estimatedDurationMinutes! >= config.mealStartMinutes
        ? config.mealBreakMinutes : 0;
      if (mealDuringVisit) mealTaken = true;
      day.stops.push({
        attractionId: place.id,
        estimatedStartTime: time(config.dayStartMinutes + elapsed),
        estimatedEndTime: time(config.dayStartMinutes + elapsed + place.estimatedDurationMinutes! + mealDuringVisit),
        estimatedVisitMinutes: place.estimatedDurationMinutes!,
        estimatedTravelMinutesFromPrevious: travel, includedMealBreakMinutes: mealDuringVisit,
      });
      elapsed += place.estimatedDurationMinutes! + mealDuringVisit;
      day.estimatedActivityCostMYR = money(day.estimatedActivityCostMYR + place.estimatedCostMYR!);
      remaining = remaining.filter(candidate => candidate.id !== place.id);
      previous = place;
    }
    day.reservedMealBreakMinutes = day.stops.length ? config.mealBreakMinutes : 0;
    day.estimatedScheduledMinutes = elapsed + (mealTaken ? 0 : day.reservedMealBreakMinutes);
    days.push(day);
  }
  for (const place of remaining) reasons[place.id] = 'Could not fit within the daily time, stop or local-transfer limits. Longer transfers need a separate travel plan.';
  const unscheduledAttractionIds = selected.filter(place => Object.hasOwn(reasons, place.id)).map(place => place.id);
  const total = money(days.reduce((sum, day) => sum + day.estimatedActivityCostMYR, 0));
  const warnings = [
    'Provisional activity allowances per person, not live ticket prices or a full-trip cost. Flights, accommodation, transport fares, general meals and shopping purchases are excluded.',
    'Travel minutes use straight-line distance, a configurable distance multiplier and assumed speed; these are not live routes. Opening hours, terrain and transport availability are unverified.',
    'Times are approximate destination-local activity windows. A flexible meal hour is reserved each day; arrival, departure and hotel transfers are not modelled.',
  ];
  if (!selected.length) warnings.push('Select attractions to build a trip.');
  if (unscheduledAttractionIds.length) warnings.push(`${unscheduledAttractionIds.length} selected attractions could not fit into the available ${dayCount}-day itinerary with the current visit metadata and travel limits.`);
  if (input.groupBudgetCeilingMYR != null && total > input.groupBudgetCeilingMYR) warnings.push(`Estimated activities alone exceed the per-person group budget ceiling by RM${money(total - input.groupBudgetCeilingMYR).toFixed(2)}.`);
  return {
    plannerVersion: '1.0', days, unscheduledAttractionIds, unscheduledReasons: reasons, warnings,
    estimatedActivityTotalMYR: total, costBasis: 'per_person', travelEstimateBasis: 'straight_line_heuristic',
  };
}

/** A suggested day-by-day outline: every selected stop is included, even without planning metadata. */
export function buildSyntheticItinerary(input: PlannerInput): PlannedItinerary {
  const start = dateInstant(input.startDate);
  const count = (dateInstant(input.endDate) - start) / 86400000 + 1;
  if (count < 1 || count > 30) throw new Error('Choose a trip lasting 1–30 days.');
  const remaining = [...new Map(input.selectedAttractions.map(place => [place.id, place])).values()];
  const ordered: Attraction[] = [];
  while (remaining.length) {
    const previous = ordered.at(-1);
    if (previous) remaining.sort((a, b) => {
      const aDistance = haversineKm(previous, a);
      const bDistance = haversineKm(previous, b);
      return (Number.isFinite(aDistance) ? aDistance : Infinity) - (Number.isFinite(bDistance) ? bDistance : Infinity) || idOrder(a, b);
    });
    ordered.push(remaining.shift()!);
  }
  let cursor = 0;
  const days: PlannedDay[] = Array.from({ length: count }, (_, index) => {
    // Fill earlier days before opening another day, retaining every selected stop.
    let stopCount = 0;
    let plannedMinutes = 0;
    while (cursor + stopCount < ordered.length) {
      const place = ordered[cursor + stopCount];
      const duration = roundEstimateMinutes(Number.isFinite(place.estimatedDurationMinutes) && place.estimatedDurationMinutes! > 0 ? place.estimatedDurationMinutes! : 120);
      const previous = stopCount ? ordered[cursor + stopCount - 1] : undefined;
      const distant = previous && haversineKm(previous, place) > 80;
      if (stopCount && index < count - 1 && (stopCount >= 4 || plannedMinutes + 30 + duration > 420 || distant)) break;
      plannedMinutes += (stopCount ? 30 : 0) + duration;
      stopCount++;
    }
    const places = ordered.slice(cursor, cursor + stopCount);
    cursor += stopCount;
    // Use consecutive visit windows with a short transfer buffer and a meal break.
    const slot = Math.max(15, Math.floor(480 / Math.max(1, stopCount) / 15) * 15);
    let dayCursor = 9 * 60;
    let mealTaken = false;
    const stops = places.map((place, stopIndex) => {
      const duration = Math.min(roundEstimateMinutes(Number.isFinite(place.estimatedDurationMinutes) && place.estimatedDurationMinutes! > 0 ? place.estimatedDurationMinutes! : 120), Math.max(15, slot - 15));
      if (stopIndex) dayCursor += stopCount <= 4 ? 30 : 0;
      if (!mealTaken && dayCursor >= 12 * 60) { dayCursor += 60; mealTaken = true; }
      const begins = dayCursor;
      const mealDuringVisit = !mealTaken && begins + duration >= 12 * 60 ? 60 : 0;
      if (mealDuringVisit) mealTaken = true;
      dayCursor += duration + mealDuringVisit;
      return { attractionId: place.id, estimatedStartTime: time(begins), estimatedEndTime: time(dayCursor), estimatedVisitMinutes: duration, estimatedTravelMinutesFromPrevious: stopIndex && stopCount <= 4 ? 30 : 0, includedMealBreakMinutes: mealDuringVisit };
    });
    return { date: new Date(start + index * 86400000).toISOString().slice(0, 10), stops,
      estimatedActivityCostMYR: money(places.reduce((total, place) => total + (Number.isFinite(place.estimatedCostMYR) && place.estimatedCostMYR! >= 0 ? place.estimatedCostMYR! : 0), 0)),
      estimatedScheduledMinutes: stops.reduce((total, stop) => total + stop.estimatedVisitMinutes + stop.estimatedTravelMinutesFromPrevious, 0) + (stops.length ? 60 : 0), reservedMealBreakMinutes: stops.length ? 60 : 0 };
  });
  return { plannerVersion: '1.0', days, unscheduledAttractionIds: [], unscheduledReasons: {},
    warnings: ['Suggested itinerary with approximate visit windows. Travel connections and opening hours still need checking.'],
    estimatedActivityTotalMYR: money(days.reduce((total, day) => total + day.estimatedActivityCostMYR, 0)), costBasis: 'per_person', travelEstimateBasis: 'straight_line_heuristic' };
}
