import type { Attraction } from '../../../packages/contracts/src/countries';
import type { TripModeData } from '../../../packages/contracts/src/trip-mode';
import type { TripVibe } from '../../../packages/contracts/src/trip-vibe';
import { haversineKm, type PlannedDay } from '@/domain/itinerary-planner';
export type Disruption = 'weather' | 'unavailable' | 'late';
export type Rescue = { day: PlannedDay; removed: string[]; added: string[]; reasons: string[]; budgetDelta: number | null };
const minutes = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
const clock = (n: number) => `${Math.floor(n / 60).toString().padStart(2, '0')}:${(n % 60).toString().padStart(2, '0')}`;
const valid = (p: Attraction) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180;
const travel = (a: Attraction, b: Attraction) => Math.max(10, Math.ceil(haversineKm(a, b) * 1.3 / 25 * 60));
export function rescueDay({ data, date, places, reason, targetId, delay = 30, vibes = [], activityBudget }: {
  data: TripModeData; date: string; places: Attraction[]; reason: Disruption; targetId?: string; delay?: number;
  vibes?: readonly TripVibe[]; activityBudget?: number;
}): Rescue | null {
  const original = data.days.find(d => d.date === date);
  if (!original) return null;
  const byId = new Map(places.map(p => [p.id, p]));
  const done = new Set(data.completedIds);
  const pending = original.stops.filter(s => !done.has(s.attractionId));
  if (!pending.length) return null;
  const day: PlannedDay = { ...original, stops: original.stops.map(s => ({ ...s })) };
  const costsKnown = data.days.flatMap(d => d.stops).every(s => Number.isFinite(byId.get(s.attractionId)?.estimatedCostMYR));
  const total = data.days.flatMap(d => d.stops).reduce((n, s) => n + (byId.get(s.attractionId)?.estimatedCostMYR ?? 0), 0);
  if (reason === 'late') {
    if (![15, 30, 60, 90].includes(delay)) return null;
    // Shift only unfinished stops; never move a completed stop or silently drop a booking.
    for (const stop of day.stops) {
      if (done.has(stop.attractionId)) continue;
      const end = minutes(stop.estimatedEndTime) + delay;
      if (end >= 1440) return null;
      stop.estimatedStartTime = clock(minutes(stop.estimatedStartTime) + delay);
      stop.estimatedEndTime = clock(end);
    }
    if (day.stops.some((s, i) => i > 0 && day.stops[i - 1].estimatedEndTime > s.estimatedStartTime)) return null;
    return { day, removed: [], added: [], budgetDelta: 0, reasons: [`Move remaining stops ${delay} minutes later.`, 'Completed stops stay unchanged.', 'Check opening hours and timed tickets before applying.'] };
  }
  const affected = pending.filter(s => reason === 'unavailable' ? s.attractionId === targetId : ['outdoor', 'mixed'].includes(byId.get(s.attractionId)?.indoorOutdoor ?? ''));
  if (!affected.length) return null;
  const used = new Set(data.days.flatMap(d => d.stops.map(s => s.attractionId)));
  const removed: string[] = [], added: string[] = [], reasons: string[] = [];
  let delta = 0;
  for (const old of affected) {
    const index = day.stops.findIndex(s => s.attractionId === old.attractionId);
    const oldPlace = byId.get(old.attractionId);
    if (!oldPlace || !valid(oldPlace) || !Number.isFinite(oldPlace.estimatedCostMYR)) return null;
    const previous = index ? byId.get(day.stops[index - 1].attractionId) : oldPlace;
    const nextStop = day.stops[index + 1];
    const nextPlace = nextStop ? byId.get(nextStop.attractionId) : undefined;
    if (!previous || !valid(previous) || (nextStop && (!nextPlace || !valid(nextPlace)))) return null;
    const candidates = places.filter(p => !used.has(p.id) && p.countryId === oldPlace.countryId && valid(p) &&
      !p.requiresSpecialPlanning && (reason !== 'weather' || p.indoorOutdoor === 'indoor') &&
      Number.isFinite(p.estimatedCostMYR) && p.estimatedCostMYR! >= 0 && Number.isInteger(p.estimatedDurationMinutes) && p.estimatedDurationMinutes! > 0 &&
      haversineKm(previous, p) <= 25 && (!nextPlace || haversineKm(p, nextPlace) <= 25))
      .map(p => {
        const transfer = travel(previous, p);
        const start = Math.max(minutes(old.estimatedStartTime), index ? minutes(day.stops[index - 1].estimatedEndTime) + transfer + 15 : minutes(old.estimatedStartTime) + transfer);
        const end = start + p.estimatedDurationMinutes! + old.includedMealBreakMinutes;
        return { p, transfer, start, end, score: vibes.filter(v => p.vibes?.includes(v)).length };
      }).filter(c => c.end <= minutes(old.estimatedEndTime) && (!nextStop || c.end + travel(c.p, nextPlace!) + 15 <= minutes(nextStop.estimatedStartTime)) &&
        (activityBudget == null || !costsKnown || total + delta + c.p.estimatedCostMYR! - oldPlace.estimatedCostMYR! <= activityBudget))
      .sort((a, b) => b.score - a.score || a.transfer - b.transfer || a.p.id.localeCompare(b.p.id));
    const best = candidates[0];
    if (!best) return null;
    day.stops[index] = { ...old, attractionId: best.p.id, estimatedStartTime: clock(best.start), estimatedEndTime: clock(best.end), estimatedVisitMinutes: best.p.estimatedDurationMinutes!, estimatedTravelMinutesFromPrevious: best.transfer };
    if (nextStop) nextStop.estimatedTravelMinutesFromPrevious = travel(best.p, nextPlace!);
    delta += best.p.estimatedCostMYR! - oldPlace.estimatedCostMYR!;
    used.add(best.p.id); removed.push(old.attractionId); added.push(best.p.id);
    reasons.push(`${best.p.name}: ${best.p.indoorOutdoor === 'indoor' ? 'indoor · ' : ''}about ${best.transfer} min from ${previous.name} (distance estimate).`);
    const matches = [...new Set(vibes.filter(v => best.p.vibes?.includes(v)))];
    if (matches.length) reasons.push(`Matches shared ${matches.join(', ')} preferences.`);
  }
  day.estimatedActivityCostMYR = Math.max(0, day.estimatedActivityCostMYR + delta);
  day.estimatedScheduledMinutes = day.stops.reduce((n, s) => n + s.estimatedVisitMinutes + s.estimatedTravelMinutesFromPrevious + s.includedMealBreakMinutes, day.reservedMealBreakMinutes);
  reasons.push(costsKnown && activityBudget != null ? 'Activity allowances fit the remaining crew budget.' : 'Full budget fit is unconfirmed.');
  reasons.push('Category-based allowances, not live ticket prices. Confirm opening hours, tickets and transport costs.');
  return { day, removed, added, reasons, budgetDelta: delta };
}
