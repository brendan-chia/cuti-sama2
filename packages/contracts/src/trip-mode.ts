import { z } from 'zod';
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const TripStopSchema = z.object({
  attractionId: z.string().min(1).max(160), estimatedStartTime: time, estimatedEndTime: time,
  estimatedVisitMinutes: z.number().int().positive().max(1440),
  estimatedTravelMinutesFromPrevious: z.number().int().nonnegative().max(1440),
  includedMealBreakMinutes: z.number().int().nonnegative().max(1440),
}).strict().refine(s => s.estimatedEndTime > s.estimatedStartTime, 'A stop must end after it starts.');
export const TripDaySchema = z.object({
  date: z.iso.date(), stops: z.array(TripStopSchema).max(20),
  estimatedActivityCostMYR: z.number().nonnegative(), estimatedScheduledMinutes: z.number().nonnegative(),
  reservedMealBreakMinutes: z.number().nonnegative(),
}).strict().superRefine((day, ctx) => {
  day.stops.forEach((stop, i) => { if (i && day.stops[i - 1].estimatedEndTime > stop.estimatedStartTime) ctx.addIssue({ code: 'custom', message: 'Stops overlap.' }); });
});
export const TripModeDataSchema = z.object({
  days: z.array(TripDaySchema).min(1).max(30), completedIds: z.array(z.string().min(1).max(160)).max(600),
}).strict().superRefine((data, ctx) => {
  const ids = data.days.flatMap(d => d.stops.map(s => s.attractionId));
  if (new Set(ids).size !== ids.length || new Set(data.days.map(d => d.date)).size !== data.days.length ||
      new Set(data.completedIds).size !== data.completedIds.length || data.completedIds.some(id => !ids.includes(id)))
    ctx.addIssue({ code: 'custom', message: 'Trip stops and completion must be unique and consistent.' });
});
export type TripModeData = z.infer<typeof TripModeDataSchema>;
export const TripModeStateSchema = z.object({ revision: z.number().int().nonnegative(), data: TripModeDataSchema.nullable() });
export type TripModeState = z.infer<typeof TripModeStateSchema>;
