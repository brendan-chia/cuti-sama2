import { createClient } from '@supabase/supabase-js';

import { authenticatedClient, corsHeaders, json, requestJson } from '../_shared/invites.ts';
import { provenance, requestDestinationAnnotations, type Provenance } from '../_shared/provenance.ts';
import { RecommendDestinationsPayloadSchema } from './contract.ts';

type Category = 'budget' | 'travel_time' | 'climate' | 'visa' | 'accessibility' | 'transport' | 'accommodation' | 'dealbreaker';
type Constraint = { origin: string | null; budget_min: number | null; budget_max: number | null; currency: string | null; max_travel_minutes: number | null; accessibility_requirements: string | null; climate: string | null; visa_concern: string | null; transport: string | null; accommodation: string | null };
type CatalogueRow = { id: string; slug: string; name: string; country: string; country_code: string; enabled: boolean; estimate_currency: string | null; estimate_min: number | null; estimate_max: number | null; estimate_status: 'verified' | 'estimated' | 'unavailable'; travel_times: { origin: string; minutes: number | null; status: 'verified' | 'estimated' | 'unavailable'; sourceLabel?: string | null; sourceUrl?: string | null; observedAt?: string | null }[]; interests: string[]; climate_tags: string[]; visa_tags: string[]; accessibility_tags: string[]; transport_tags: string[]; accommodation_tags: string[]; primary_compromise: string; evidence: Record<string, { status?: 'verified' | 'estimated' | 'unavailable'; sourceLabel?: string | null; sourceUrl?: string | null }>; evidence_updated_at: string | null };
type Filters = { budgetMinimum: number | null; budgetMaximum: number | null; currency: string | null; origins: string[]; maxTravelMinutes: number | null; climateTerms: string[]; visaTerms: string[]; accessibilityTerms: string[]; transportTerms: string[]; accommodationTerms: string[]; dealbreakerTerms: string[] };

const norm = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
const useful = (value: string | null) => value && !['none', 'no requirements', 'n/a'].includes(norm(value)) ? value : null;
function terms(value: string | null, known: string[]) { const normalized = value ? norm(value) : ''; return known.filter((term) => normalized.includes(term)); }
function buildFilters(rows: Constraint[], dealbreakers: string[]): Filters {
  const budgets = rows.filter((row) => row.budget_min !== null && row.budget_max !== null && row.currency);
  const currencies = new Set(budgets.map((row) => row.currency!));
  return {
    budgetMinimum: budgets.length ? Math.max(...budgets.map((row) => Number(row.budget_min))) : null,
    budgetMaximum: budgets.length ? Math.min(...budgets.map((row) => Number(row.budget_max))) : null,
    currency: currencies.size === 1 ? [...currencies][0] : currencies.size > 1 ? 'MIX' : null,
    origins: [...new Set(rows.map((row) => row.origin).filter((value): value is string => Boolean(useful(value))))],
    maxTravelMinutes: rows.some((row) => row.max_travel_minutes !== null) ? Math.min(...rows.map((row) => row.max_travel_minutes).filter((value): value is number => value !== null)) : null,
    climateTerms: [...new Set(rows.flatMap((row) => terms(row.climate, ['warm', 'cool', 'mild', 'dry', 'tropical'])))],
    visaTerms: [...new Set(rows.flatMap((row) => terms(row.visa_concern, ['visa-free', 'domestic', 'visa required'])))],
    accessibilityTerms: [...new Set(rows.flatMap((row) => terms(row.accessibility_requirements, ['step-free', 'wheelchair', 'sensory', 'dietary'])))],
    transportTerms: [...new Set(rows.flatMap((row) => terms(row.transport, ['direct flight', 'public bus', 'rail', 'ride hailing'])))],
    accommodationTerms: [...new Set(rows.flatMap((row) => terms(row.accommodation, ['private room', 'resort', 'hotel', 'hostel'])))],
    dealbreakerTerms: dealbreakers.filter((value) => Boolean(useful(value))),
  };
}
function tagMatch(required: string[], tags: string[]) { return required.every((term) => tags.some((tag) => norm(tag).includes(norm(term)) || norm(term).includes(norm(tag)))); }
function evaluate(row: CatalogueRow, filters: Filters) {
  const failed = new Set<Category>(); const reasons: string[] = [];
  if (filters.currency === 'MIX') failed.add('budget');
  else if (filters.currency && filters.budgetMaximum !== null) {
    if (row.estimate_currency !== filters.currency || row.estimate_min === null || row.estimate_max === null || row.estimate_min > filters.budgetMaximum || (filters.budgetMinimum !== null && row.estimate_max < filters.budgetMinimum)) failed.add('budget');
    else reasons.push(`Estimated ${row.estimate_currency} ${row.estimate_min}–${row.estimate_max} overlaps the group budget.`);
  }
  if (filters.maxTravelMinutes !== null) {
    const routes = filters.origins.map((origin) => row.travel_times.find((route) => norm(route.origin) === norm(origin)));
    if (!routes.length || routes.some((route) => !route || route.minutes === null || route.minutes > filters.maxTravelMinutes!)) failed.add('travel_time');
    else reasons.push('Estimated travel time is within every submitted maximum.');
  }
  const checks: [Category, string[], string[]][] = [['climate', filters.climateTerms, row.climate_tags], ['visa', filters.visaTerms, row.visa_tags], ['accessibility', filters.accessibilityTerms, row.accessibility_tags], ['transport', filters.transportTerms, row.transport_tags], ['accommodation', filters.accommodationTerms, row.accommodation_tags]];
  for (const [category, required, tags] of checks) { if (required.length && !tagMatch(required, tags)) failed.add(category); else if (required.length) reasons.push(`${category.replace('_', ' ')} requirements have catalogue support.`); }
  const searchable = [row.name, row.country, ...row.interests, ...row.climate_tags, ...row.transport_tags, ...row.accommodation_tags].map(norm).join(' ');
  if (filters.dealbreakerTerms.some((term) => searchable.includes(norm(term)))) failed.add('dealbreaker');
  if (row.interests.length) reasons.push(`Interests include ${row.interests.slice(0, 3).join(', ')}.`);
  return { eligible: row.enabled && failed.size === 0, failedCategories: [...failed], matchReasons: reasons };
}
function evidenceFor(row: CatalogueRow, asOf: Date) {
  const at = row.evidence_updated_at;
  const entry = (key: string, field: string, fallback: 'verified' | 'estimated' | 'unavailable') => provenance({ status: row.evidence[key]?.status ?? fallback, field, sourceLabel: row.evidence[key]?.sourceLabel, sourceUrl: row.evidence[key]?.sourceUrl, observedAt: at }, asOf);
  return [entry('estimate', 'Cost', row.estimate_status), entry('visa', 'Visa', 'unavailable'), entry('safety', 'Safety', 'unavailable'), entry('openingHours', 'Opening hours', 'unavailable'), entry('availability', 'Availability', 'unavailable')];
}
function confidence(supported: boolean, evidence: Provenance[]) {
  if (!supported) return { level: 'low', label: 'Low confidence', warning: 'Not in the launch catalogue. Cost, travel, visa, safety, opening-hour, and availability data may be unavailable.' };
  if (evidence.some((item) => item.status === 'unavailable')) return { level: 'low', label: 'Low confidence', warning: 'Some decision-critical data is unavailable.' };
  if (evidence.some((item) => item.status === 'estimated' || item.stale)) return { level: 'medium', label: 'Medium confidence', warning: 'Some evidence is estimated or may be out of date.' };
  return { level: 'high', label: 'High confidence', warning: null };
}
function supportedCard(row: CatalogueRow, filters: Filters, asOf: Date) {
  const evaluation = evaluate(row, filters); const evidence = evidenceFor(row, asOf);
  const travelTimes = filters.origins.map((origin) => {
    const route = row.travel_times.find((item) => norm(item.origin) === norm(origin));
    return { origin, minutes: route?.minutes ?? null, evidence: provenance({ status: route?.status ?? 'unavailable', field: 'Travel time', sourceLabel: route?.sourceLabel, sourceUrl: route?.sourceUrl, observedAt: route?.observedAt ?? null }, asOf) };
  });
  return { destinationId: `catalogue:${row.id}`, catalogueId: row.id, name: row.name, country: row.country, supported: true, eligible: evaluation.eligible, excludedBy: evaluation.failedCategories, matchReasons: evaluation.matchReasons, estimate: { currency: row.estimate_currency, minimum: row.estimate_min === null ? null : Number(row.estimate_min), maximum: row.estimate_max === null ? null : Number(row.estimate_max), evidence: evidence[0] }, travelTimes, interests: row.interests, primaryCompromise: row.primary_compromise, confidence: confidence(true, [...evidence, ...travelTimes.map((item) => item.evidence)]), provenance: [...evidence, ...travelTimes.map((item) => item.evidence)] };
}
function unsupportedCard(destination: { id: string; name: string }, asOf: Date) {
  const unavailable = (field: string) => provenance({ status: 'unavailable', field }, asOf); const evidence = ['Cost', 'Travel time', 'Visa', 'Safety', 'Opening hours', 'Availability'].map(unavailable);
  return { destinationId: `manual:${destination.id}`, catalogueId: null, name: destination.name, country: null, supported: false, eligible: true, excludedBy: [], matchReasons: ['Included because the group manually shortlisted it.'], estimate: { currency: null, minimum: null, maximum: null, evidence: evidence[0] }, travelTimes: [], interests: [], primaryCompromise: 'Catalogue evidence is unavailable, so this destination needs manual verification.', confidence: confidence(false, evidence), provenance: evidence };
}
async function hash(value: unknown) { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))); return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join(''); }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  let memberClient; try { memberClient = await authenticatedClient(request); } catch { return json({ error: 'Function configuration is incomplete.' }, 500); }
  if (!memberClient) return json({ error: 'Member session is invalid or expired.' }, 401);
  const parsed = RecommendDestinationsPayloadSchema.safeParse(await requestJson(request)); if (!parsed.success) return json({ error: 'Destination request is invalid.' }, 400);
  const { data: membership } = await memberClient.from('trip_members').select('id').eq('trip_id', parsed.data.tripId).eq('active', true).maybeSingle(); if (!membership) return json({ error: 'Trip Room access is unavailable.' }, 403);
  const url = Deno.env.get('SUPABASE_URL'); const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); if (!url || !serviceKey) return json({ error: 'Function configuration is incomplete.' }, 500);
  const service = createClient(url, serviceKey, { auth: { persistSession: false } });
  const [tripQuery, constraintsQuery, manualQuery, catalogueQuery, roundsQuery, matchQuery] = await Promise.all([
    service.from('trips').select('id,name,mode,constraints_locked_at').eq('id', parsed.data.tripId).single(),
    service.from('member_constraints').select('origin,budget_min,budget_max,currency,max_travel_minutes,accessibility_requirements,climate,visa_concern,transport,accommodation').eq('trip_id', parsed.data.tripId).order('member_id'),
    service.from('trip_destinations').select('id,name,sort_order').eq('trip_id', parsed.data.tripId).order('sort_order'),
    service.from('destination_catalogue').select('*').order('name'),
    service.from('preference_rounds').select('id,kind,closed_at').eq('trip_id', parsed.data.tripId).eq('kind', 'avoid').maybeSingle(),
    service.from('recommendation_runs').select('status').eq('trip_id', parsed.data.tripId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (tripQuery.error || constraintsQuery.error || manualQuery.error || catalogueQuery.error || roundsQuery.error || matchQuery.error) return json({ error: 'Could not load destination inputs.' }, 500);
  if (!tripQuery.data.constraints_locked_at) return json({ error: 'Lock constraints before evaluating destinations.' }, 409);
  if (!matchQuery.data) return json({ error: 'Reveal the group match before evaluating destinations.' }, 409);
  if (matchQuery.data.status === 'blocked') return json({ error: 'Resolve the group match blocking categories before evaluating destinations.' }, 409);
  let dealbreakers: string[] = [];
  if (roundsQuery.data?.closed_at) { const values = await service.from('preference_submissions').select('value').eq('round_id', roundsQuery.data.id); if (!values.error) dealbreakers = values.data.map((item) => item.value); }
  const filters = buildFilters(constraintsQuery.data as Constraint[], dealbreakers); const asOf = new Date(); const catalogue = catalogueQuery.data as CatalogueRow[];
  const manualCards = manualQuery.data.map((manual) => { const found = catalogue.find((row) => row.enabled && norm(row.name) === norm(manual.name)); return found ? supportedCard(found, filters, asOf) : unsupportedCard(manual, asOf); });
  const allEvaluated = catalogue.filter((row) => row.enabled).map((row) => supportedCard(row, filters, asOf));
  let cards; let kind: 'locked' | 'comparison' | 'discovery'; let noMatch: { revisionCategories: Category[] } | null = null;
  if (tripQuery.data.mode === 'undecided') {
    kind = 'discovery'; cards = allEvaluated.filter((card) => card.eligible).slice(0, 3);
    if (!cards.length) { const closest = allEvaluated.filter((card) => card.excludedBy.length).sort((a, b) => a.excludedBy.length - b.excludedBy.length)[0]; noMatch = { revisionCategories: closest?.excludedBy ?? ['budget'] }; }
  } else { kind = tripQuery.data.mode === 'shortlist' ? 'comparison' : 'locked'; cards = manualCards; }
  const allowedForAi = cards.filter((card) => card.eligible).map((card) => ({ destinationId: card.destinationId, matchReasons: card.matchReasons }));
  const ai = await requestDestinationAnnotations(allowedForAi);
  if (ai) for (const annotation of ai.destinations) { const card = cards.find((item) => item.destinationId === annotation.destinationId); if (card) card.matchReasons = annotation.reasonOrder.map((index) => card.matchReasons[index]); }
  const deterministic = { tripId: tripQuery.data.id, tripName: tripQuery.data.name, mode: tripQuery.data.mode, kind, destinations: cards, noMatch, generatedAt: asOf.toISOString() };
  const fingerprint = await hash({ constraints: constraintsQuery.data, manual: manualQuery.data, catalogue: catalogueQuery.data, dealbreakers });
  await service.from('destination_recommendation_runs').upsert({ trip_id: parsed.data.tripId, mode: tripQuery.data.mode, input_fingerprint: fingerprint, deterministic_result: deterministic, ai_annotations: ai }, { onConflict: 'trip_id,input_fingerprint' });
  return json(deterministic);
});
