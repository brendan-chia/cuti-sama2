import { z } from 'zod';

import { TripPeriodSchema, type TripPeriod } from './quest';

const DAY_MS = 86_400_000;

export const TripPeriodRequestSchema = z.object({
  tripId: z.uuid(),
  durationDays: z.number().int().min(2).max(14).default(5),
}).strict();

export const TripPeriodSuggestionsSchema = z.object({
  periods: z.array(TripPeriodSchema).max(3),
  source: z.enum(['groq', 'deepseek', 'calendar']),
  message: z.string().trim().min(1).max(600),
}).strict().superRefine((value, context) => {
  const seen = new Set<string>();
  value.periods.forEach((period, index) => {
    const duration = periodLength(period);
    if (duration < 2 || duration > 14 || seen.has(period.startsOn)) {
      context.addIssue({ code: 'custom', path: ['periods', index], message: 'Trip periods must be distinct, valid windows of 2–14 days.' });
    }
    seen.add(period.startsOn);
  });
});
export type TripPeriodSuggestions = z.infer<typeof TripPeriodSuggestionsSchema>;

export type AvailabilityWindow = { startsOn: string; endsOn: string };
export type TripPeriodCandidate = TripPeriod & { id: string; durationDays: number; weekdayDays: number; weekendDays: number };

function dayNumber(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const milliseconds = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString().slice(0, 10) !== value) return null;
  return milliseconds / DAY_MS;
}

const dateString = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);

export function periodLength(period: AvailabilityWindow): number {
  const start = dayNumber(period.startsOn); const end = dayNumber(period.endsOn);
  return start === null || end === null ? 0 : end - start + 1;
}

/** Exact shared-calendar windows; Saturday and Sunday are counted as weekends. */
export function buildTripPeriodCandidates(
  availability: AvailabilityWindow | null,
  durationDays: number,
  today: string = new Date().toISOString().slice(0, 10),
  limit = 12,
): TripPeriodCandidate[] {
  if (!availability || !Number.isInteger(durationDays) || durationDays < 2 || durationDays > 14) return [];
  if (!Number.isInteger(limit) || limit < 1 || limit > 24) return [];
  const start = dayNumber(availability.startsOn); const end = dayNumber(availability.endsOn); const current = dayNumber(today);
  if (start === null || end === null || current === null) return [];
  const earliest = Math.max(start, current + 1); const latest = end - durationDays + 1;
  if (earliest > latest) return [];

  // Weekday coverage repeats every seven days. This bounded pool contains enough
  // of every possible start weekday to find `limit` well-spaced best windows,
  // even when the shared availability spans years.
  const candidates: TripPeriodCandidate[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    for (let week = 0; week < limit * Math.ceil(durationDays / 7); week += 1) {
      const firstDay = earliest + offset + week * 7;
      if (firstDay > latest) break;
      let weekendDays = 0;
      for (let day = 0; day < durationDays; day += 1) {
        const weekday = new Date((firstDay + day) * DAY_MS).getUTCDay();
        if (weekday === 0 || weekday === 6) weekendDays += 1;
      }
      const startsOn = dateString(firstDay); const endsOn = dateString(firstDay + durationDays - 1);
      const weekdayDays = durationDays - weekendDays;
      candidates.push({
        id: `${startsOn}:${endsOn}`, startsOn, endsOn, durationDays, weekdayDays, weekendDays,
        label: `${durationDays} days · ${weekendDays} weekend ${weekendDays === 1 ? 'day' : 'days'}`,
        reason: `Fits everyone's shared availability, with ${weekdayDays} ${weekdayDays === 1 ? 'weekday' : 'weekdays'} and ${weekendDays} Saturday–Sunday ${weekendDays === 1 ? 'day' : 'days'}.`,
      });
    }
  }
  candidates.sort((left, right) => left.weekdayDays - right.weekdayDays || left.startsOn.localeCompare(right.startsOn));
  const selected: TripPeriodCandidate[] = [];
  for (const candidate of candidates) {
    if (selected.every((item) => candidate.startsOn > item.endsOn || candidate.endsOn < item.startsOn)) selected.push(candidate);
    if (selected.length === limit) return selected;
  }
  // A narrow shared window may only support overlapping alternatives.
  for (const candidate of candidates) {
    if (!selected.some((item) => item.id === candidate.id)) selected.push(candidate);
    if (selected.length === limit) break;
  }
  return selected;
}

/** Model output can choose only supplied IDs; all dates and wording stay factual. */
export function validateTripPeriodRanking(value: unknown, candidates: readonly TripPeriodCandidate[]): TripPeriod[] | null {
  const count = Math.min(3, candidates.length);
  const parsed = z.object({ periodIds: z.array(z.string()).length(count) }).strict().safeParse(value);
  if (!parsed.success || count === 0 || new Set(parsed.data.periodIds).size !== count) return null;
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  if (parsed.data.periodIds.some((id) => !byId.has(id))) return null;
  return parsed.data.periodIds.map((id) => asTripPeriod(byId.get(id)!));
}

export function asTripPeriod(candidate: TripPeriodCandidate): TripPeriod {
  const { startsOn, endsOn, label, reason } = candidate;
  return { startsOn, endsOn, label, reason };
}
