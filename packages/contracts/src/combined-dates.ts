import { z } from 'zod';
import { AvailabilitySchema, DatePreferencesSchema, type DateRecommendation } from './quest';

export const DateInputSchema = AvailabilitySchema.extend({ memberId: z.uuid(), preferences: DatePreferencesSchema });
export type DateInput = z.infer<typeof DateInputSchema>;
export type NationalHoliday = { date: string; name: string };
export type CombinedCandidate = DateRecommendation['periods'][number] & { id: string; maxShift: number; maxLeave: number; totalLeave: number; durationPenalty: number };
const DAY = 86400000;
const day = (date: string) => Date.parse(`${date}T00:00:00Z`) / DAY;
const iso = (date: number) => new Date(date * DAY).toISOString().slice(0, 10);

export function preferenceBounds(input: DateInput): [number, number] {
  const start = day(input.startsOn);
  if (input.preferences.flexibility === 'month') {
    const date = new Date(start * DAY);
    return [Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) / DAY, Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0) / DAY];
  }
  const shift = input.preferences.flexibility === 'exact' ? 0 : Number(input.preferences.flexibility);
  return [start - shift, start + shift];
}

/** Preferred start may move within flexibility; hard exclusions apply to every trip day.
 * Use a submitted duration, never invent a shorter trip to improve leave scores. */
export function buildCombinedCandidates(inputs: DateInput[], holidays: NationalHoliday[], today: string): CombinedCandidate[] {
  if (!inputs.length || inputs.length > 8 || inputs.some((input) => !DateInputSchema.safeParse(input).success || day(input.endsOn) - day(input.startsOn) < 0 || day(input.endsOn) - day(input.startsOn) > 29)) return [];
  const bounds = inputs.map(preferenceBounds);
  const first = Math.max(day(today) + 1, ...bounds.map(([start]) => start));
  const last = Math.min(...bounds.map(([, end]) => end));
  const lengths = [...new Set(inputs.map((input) => day(input.endsOn) - day(input.startsOn) + 1))];
  const holidayDates = new Set(holidays.map((holiday) => holiday.date));
  const result: CombinedCandidate[] = [];
  for (let start = first; start <= last; start++) for (const durationDays of lengths) {
    const end = start + durationDays - 1;
    if (inputs.some((input) => (input.preferences.flexibility === 'exact' && (start !== day(input.startsOn) || end !== day(input.endsOn))) || input.preferences.unavailable.some((range) => start <= day(range.endsOn) && end >= day(range.startsOn)))) continue;
    const travellers = inputs.map((input) => {
      let leaveDays = 0;
      for (let current = start; current <= end; current++) {
        if (!input.preferences.daysOff.includes(new Date(current * DAY).getUTCDay()) && !holidayDates.has(iso(current))) leaveDays++;
      }
      return { memberId: input.memberId, leaveDays, shiftDays: start - day(input.startsOn), durationChange: durationDays - (day(input.endsOn) - day(input.startsOn) + 1) };
    });
    const startsOn = iso(start); const endsOn = iso(end);
    const includedHolidays = holidays.filter((holiday) => holiday.date >= startsOn && holiday.date <= endsOn);
    const maxShift = Math.max(...travellers.map((traveller) => Math.abs(traveller.shiftDays)));
    const maxLeave = Math.max(...travellers.map((traveller) => traveller.leaveDays));
    const totalLeave = travellers.reduce((sum, traveller) => sum + traveller.leaveDays, 0);
    const durationPenalty = travellers.reduce((sum, traveller) => sum + Math.abs(traveller.durationChange), 0);
    result.push({ id: `${startsOn}:${endsOn}`, startsOn, endsOn, durationDays, travellers, holidays: includedHolidays,
      maxShift, maxLeave, totalLeave, durationPenalty,
      label: `${durationDays} days together`,
      reason: `Respects everyone's unavailable dates and flexibility. Up to ${maxLeave} estimated leave days per person; preferred starts move by at most ${maxShift} days.${durationPenalty ? ' Trip length differs from some proposals; review the changes below.' : ' Preserves everyone’s proposed trip length.'}`,
    });
  }
  return result.sort((a, b) => a.durationPenalty - b.durationPenalty || a.maxLeave - b.maxLeave || a.totalLeave - b.totalLeave || a.maxShift - b.maxShift || a.startsOn.localeCompare(b.startsOn)).slice(0, 24);
}

export function recommendationPeriod(candidate: CombinedCandidate): DateRecommendation['periods'][number] {
  const { startsOn, endsOn, label, reason, durationDays, holidays, travellers } = candidate;
  return { startsOn, endsOn, label, reason, durationDays, holidays, travellers };
}

/** No generated dates or prose can override verified calendar facts. */
export function validateCombinedRanking(value: unknown, candidates: CombinedCandidate[]): CombinedCandidate[] | null {
  const parsed = z.object({ periodIds: z.array(z.string()).length(Math.min(3, candidates.length)) }).strict().safeParse(value);
  if (!parsed.success || !candidates.length || new Set(parsed.data.periodIds).size !== parsed.data.periodIds.length) return null;
  const selected = parsed.data.periodIds.map((id) => candidates.find((candidate) => candidate.id === id));
  if (selected.some((candidate) => !candidate)) return null;
  // The model cannot make the main recommendation worse on the primary fairness criteria.
  const best = candidates[0]; const main = selected[0]!;
  if (main.durationPenalty > best.durationPenalty || main.maxLeave > best.maxLeave || main.totalLeave > best.totalLeave) return null;
  return selected as CombinedCandidate[];
}
