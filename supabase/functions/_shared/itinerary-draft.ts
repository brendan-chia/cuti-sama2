import { z } from 'zod';

// Repeated provenance, IDs, currency and confidence belong to the server, not
// dozens of repeated model fields. Keep the generated schedule compact.
const text = z.string().min(1).max(160);
export const CompactItinerarySchema = z.object({
  summary: z.string().min(1).max(600),
  days: z.array(z.object({
    title: text,
    activities: z.array(z.object({
      title: text, description: z.string().min(1).max(240),
      start: z.string(), end: z.string(), timezone: text,
      placeId: z.string().nullable(),
      location: z.object({ name: text, latitude: z.number().min(-90).max(90).nullable(), longitude: z.number().min(-180).max(180).nullable() }).strict().nullable(),
      minimum: z.number().min(0), maximum: z.number().min(0), travelMinutes: z.number().int().min(0).max(1440),
      reason: text,
    }).strict()).max(6),
  }).strict()).min(1).max(30),
  warnings: z.array(z.string().min(1).max(300)).max(10),
}).strict();

const ContextSchema = z.object({
  destination: z.object({ name: z.string(), country: z.string().nullable() }),
  dates: z.object({ startsOn: z.string().nullable(), endsOn: z.string().nullable() }).optional(),
  hardConstraints: z.object({ currency: z.string().nullable().optional() }).optional(),
  selectedPlaces: z.array(z.object({ id: z.string(), name: z.string(), latitude: z.number(), longitude: z.number() })).optional(),
  sourceTimestamps: z.array(z.string()).min(1),
});

export function expandItineraryDraft(value: unknown, input: unknown) {
  const parsed = CompactItinerarySchema.safeParse(value);
  const context = ContextSchema.safeParse(input);
  if (!parsed.success || !context.success) return null;
  const source = context.data;
  const confidence = { level: 'low', score: 40, reason: 'AI planning estimate; verify opening times, routes and prices.' };
  const days = parsed.data.days.map((day, dayIndex) => ({
    dayNumber: dayIndex + 1,
    date: source.dates?.startsOn ? new Date(Date.parse(source.dates.startsOn) + dayIndex * 86400000).toISOString().slice(0, 10) : null,
    title: day.title,
    activities: day.activities.map((item, activityIndex) => {
      const place = source.selectedPlaces?.find(p => p.id === item.placeId);
      if (item.placeId && !place) throw new Error('Unknown selected place.');
      if (!place && !item.location) throw new Error('Activity location missing.');
      return {
        activityId: `day-${dayIndex + 1}-activity-${activityIndex + 1}`,
        title: item.title, description: item.description,
        timeBlock: { start: item.start, end: item.end, timezone: item.timezone },
        location: { name: place?.name ?? item.location!.name, address: null, latitude: place ? place.latitude : item.location!.latitude, longitude: place ? place.longitude : item.location!.longitude },
        estimate: { currency: source.hardConstraints?.currency ?? 'MYR', minimum: item.minimum, maximum: item.maximum, basis: 'per_person', sourceTimestamp: source.sourceTimestamps[0] },
        travelMinutes: item.travelMinutes,
        rationale: { explanation: `Supports the trip preferences: ${item.reason}`, groupSignal: place ? 'must_have' : 'pace' },
        warnings: [], confidence, sourceTimestamps: source.sourceTimestamps.slice(0, 10), tags: place ? [`place:${place.id}`] : [],
        accessibility: { status: 'unknown', features: [], notes: 'Accessibility has not been verified.' },
      };
    }),
  }));
  if (!days.some(day => day.activities.length)) return null;
  return { schemaVersion: '1.0', destination: source.destination, summary: parsed.data.summary, days,
    warnings: [...parsed.data.warnings, 'AI planning estimates; check accessibility, opening times and prices before booking.'].slice(0,20), confidence, sourceTimestamps: source.sourceTimestamps.slice(0,20) };
}

export function compactItineraryJsonSchema(dayCount: number, hasTravelWindow: boolean) {
  const schema = CompactItinerarySchema.extend({ days: z.array(CompactItinerarySchema.shape.days.element.extend({
    activities: hasTravelWindow ? CompactItinerarySchema.shape.days.element.shape.activities : CompactItinerarySchema.shape.days.element.shape.activities.min(3),
  })).min(dayCount).max(dayCount) });
  return z.toJSONSchema(schema);
}
