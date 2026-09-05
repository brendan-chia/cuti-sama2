import { readFileSync } from 'node:fs';
import { z } from 'zod';
const schema = z.object({
  version: z.string().min(1), coveredYears: z.array(z.number().int().min(2026).max(2100)).min(1),
  checkedAt: z.iso.date(), sourceUrl: z.url().refine((url) => new URL(url).hostname === 'www.kabinet.gov.my'),
  sources: z.array(z.url().refine((url) => new URL(url).hostname === 'www.kabinet.gov.my')).min(1),
  notice: z.string().min(1), holidays: z.array(z.object({ date: z.iso.date(), name: z.string().min(1) }).strict()).min(1),
}).strict();
const calendar = schema.parse(JSON.parse(readFileSync(process.argv[2] ?? 'data/malaysia-national-holidays.json', 'utf8')));
if (calendar.holidays.some((holiday) => !calendar.coveredYears.includes(Number(holiday.date.slice(0, 4))))) throw new Error('Holiday outside declared year coverage');
if (new Set(calendar.holidays.map((h) => `${h.date}:${h.name}`)).size !== calendar.holidays.length) throw new Error('Duplicate holiday');
if (new Set(calendar.coveredYears).size !== calendar.coveredYears.length) throw new Error('Duplicate covered year');
const quote = (value) => `'${value.replaceAll("'", "''")}'`;
console.log(`-- Reviewed sources: ${calendar.sources.join(', ')}\nupdate public.national_holiday_calendar set\n  version = ${quote(calendar.version)},\n  covered_years = array[${calendar.coveredYears.join(',')}],\n  holidays = ${quote(JSON.stringify(calendar.holidays))}::jsonb,\n  source_url = ${quote(calendar.sourceUrl)},\n  checked_at = ${quote(calendar.checkedAt)},\n  notice = ${quote(calendar.notice)}\nwhere id = 1;`);
