import { createClient } from '@supabase/supabase-js';

import { authenticatedClient, corsHeaders, json, requestJson } from '../_shared/invites.ts';
import { requestGroqWording } from '../_shared/groq.ts';
import { GroupMatchPayloadSchema } from './contract.ts';

type Member = { id: string; display_name: string; display_name_discriminator: number };
type Constraint = {
  member_id: string; starts_on: string | null; ends_on: string | null; budget_min: number | null; budget_max: number | null;
  currency: string | null; max_travel_minutes: number | null; origin: string | null; accessibility_requirements: string | null;
  accessibility_visibility_consent: boolean; climate: string | null; visa_concern: string | null; transport: string | null; accommodation: string | null;
};
type Submission = { round_id: string; member_id: string; value: string };
type Round = { id: string; kind: 'vibe' | 'pace' | 'must_have' | 'nice_to_have' | 'avoid'; closed_at: string | null };
type Source = { sourceId: string; memberId: string; attribution: string | null; groupVisible: boolean; inputKind: 'constraint' | 'preference'; category: string; value: string };
type Fact = { factId: string; kind: 'agreement' | 'minority_must_have' | 'dealbreaker' | 'unresolved_conflict'; category: string; title: string; detail: string; sourceIds: string[] };

const normalize = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
const token = (value: string) => normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'item';
const label = (member: Member) => `${member.display_name}${member.display_name_discriminator > 1 ? ` · ${member.display_name_discriminator}` : ''}`;

function deterministicResult(input: { trip: { id: string; name: string; mode: string }; members: Member[]; constraints: Constraint[]; rounds: Round[]; submissions: Submission[]; generatedAt: string }) {
  const sources: Source[] = []; const facts: Fact[] = []; const blocking = new Set<string>();
  const byMember = new Map(input.members.map((member) => [member.id, member]));
  const addConstraint = (row: Constraint, category: string, value: string) => {
    const member = byMember.get(row.member_id)!;
    const visible = category === 'accessibility' && row.accessibility_visibility_consent;
    const source: Source = { sourceId: `constraint:${row.member_id}:${category}`, memberId: row.member_id, attribution: visible ? label(member) : null, groupVisible: visible, inputKind: 'constraint', category, value };
    sources.push(source); return source.sourceId;
  };
  const dated = input.constraints.filter((row) => row.starts_on && row.ends_on);
  if (dated.length > 1) {
    const start = dated.map((row) => row.starts_on!).sort().at(-1)!; const end = dated.map((row) => row.ends_on!).sort()[0];
    const sourceIds = dated.map((row) => addConstraint(row, 'dates', `${row.starts_on} to ${row.ends_on}`));
    if (start > end) { blocking.add('dates'); facts.push({ factId: 'conflict:dates', kind: 'unresolved_conflict', category: 'dates', title: 'Travel dates do not overlap', detail: 'The submitted date windows have no shared day.', sourceIds }); }
    else facts.push({ factId: 'agreement:dates', kind: 'agreement', category: 'dates', title: 'Shared travel window', detail: `${start} to ${end} works across the submitted date windows.`, sourceIds });
  }
  const budgets = input.constraints.filter((row) => row.budget_min !== null && row.budget_max !== null && row.currency);
  if (budgets.length > 1) {
    const currencies = new Set(budgets.map((row) => row.currency!));
    const sourceIds = budgets.map((row) => addConstraint(row, 'budget', `${row.currency} ${row.budget_min}–${row.budget_max}`));
    const minimum = Math.max(...budgets.map((row) => Number(row.budget_min))); const maximum = Math.min(...budgets.map((row) => Number(row.budget_max)));
    if (currencies.size > 1 || minimum > maximum) {
      blocking.add('budget'); facts.push({ factId: currencies.size > 1 ? 'conflict:budget-currency' : 'conflict:budget', kind: 'unresolved_conflict', category: 'budget', title: currencies.size > 1 ? 'Budget currencies are unresolved' : 'Budgets do not overlap', detail: currencies.size > 1 ? 'The submitted budgets use different currencies and cannot be compared without an agreed conversion.' : 'The submitted budget ranges have no shared amount.', sourceIds });
    } else facts.push({ factId: 'agreement:budget', kind: 'agreement', category: 'budget', title: 'Shared budget range', detail: `${budgets[0].currency} ${minimum}–${maximum} fits every submitted budget.`, sourceIds });
  }
  const fields = [['origin', 'origin'], ['accessibility_requirements', 'accessibility'], ['climate', 'climate'], ['visa_concern', 'visa'], ['transport', 'transport'], ['accommodation', 'accommodation']] as const;
  for (const row of input.constraints) for (const [field, category] of fields) {
    const value = row[field]; if (!value) continue; const sourceId = addConstraint(row, category, value);
    facts.push({ factId: `agreement:${category}:${token(value)}:${row.member_id.slice(0, 8)}`, kind: 'agreement', category, title: `${category[0].toUpperCase()}${category.slice(1)} to respect`, detail: value, sourceIds: [sourceId] });
  }
  const roundById = new Map(input.rounds.map((round) => [round.id, round]));
  const grouped = new Map<string, { kind: Round['kind']; value: string; sourceIds: string[] }>();
  for (const row of input.submissions) {
    const round = roundById.get(row.round_id); const member = byMember.get(row.member_id); if (!round || !member || !round.closed_at) continue;
    const sourceId = `preference:${row.round_id}:${row.member_id}`;
    sources.push({ sourceId, memberId: row.member_id, attribution: label(member), groupVisible: true, inputKind: 'preference', category: 'preference', value: row.value });
    const key = `${round.kind}:${normalize(row.value)}`; const group = grouped.get(key) ?? { kind: round.kind, value: row.value, sourceIds: [] }; group.sourceIds.push(sourceId); grouped.set(key, group);
  }
  for (const [key, group] of grouped) {
    if (group.kind === 'avoid') facts.push({ factId: `dealbreaker:${token(key)}`, kind: 'dealbreaker', category: 'preference', title: 'Dealbreaker', detail: group.value, sourceIds: group.sourceIds });
    else if (group.kind === 'must_have' && group.sourceIds.length < input.members.length) facts.push({ factId: `minority:${token(key)}`, kind: 'minority_must_have', category: 'preference', title: 'Minority Must-have', detail: group.value, sourceIds: group.sourceIds });
    else if (group.sourceIds.length >= 2 || input.members.length === 1) facts.push({ factId: `agreement:${group.kind}:${token(key)}`, kind: 'agreement', category: 'preference', title: group.kind === 'must_have' ? 'Shared Must-have' : 'Common preference', detail: group.value, sourceIds: group.sourceIds });
  }
  for (const kind of ['vibe', 'pace'] as const) {
    const groups = [...grouped.values()].filter((group) => group.kind === kind);
    if (groups.length < 2 || groups.some((group) => group.sourceIds.length >= 2)) continue;
    facts.push({ factId: `conflict:${kind}`, kind: 'unresolved_conflict', category: 'preference', title: `${kind === 'vibe' ? 'Vibe' : 'Pace'} is still unresolved`, detail: `The group submitted different ${kind} preferences without a common choice.`, sourceIds: groups.flatMap((group) => group.sourceIds) });
  }
  const blockingCategories = [...blocking]; const status = blockingCategories.length ? 'blocked' : 'matched';
  const actions: Record<string, { kind: string; label: string; tail: string }> = {
    shortlist: { kind: 'compare_shortlist', label: 'Compare the shortlist', tail: 'destinations' },
    undecided: { kind: 'discover_destinations', label: 'Discover destinations', tail: 'destinations' },
    destination_locked: { kind: 'generate_itinerary', label: 'Generate an itinerary', tail: 'itinerary' },
  };
  const action = actions[input.trip.mode];
  return {
    runId: null, tripId: input.trip.id, tripName: input.trip.name, mode: input.trip.mode, status, facts, sources, blockingCategories,
    nextAction: { kind: action.kind, label: action.label, route: `/trip/${input.trip.id}/${action.tail}` }, generatedAt: input.generatedAt,
    prose: { heading: status === 'blocked' ? 'The group needs one more decision' : 'Here’s where the group aligns', summary: status === 'blocked' ? `No valid match remains until the group resolves: ${blockingCategories.join(', ')}.` : 'This reveal is calculated only from the group’s submitted constraints and revealed preference cards.', factWording: {}, source: 'deterministic' },
  };
}

async function fingerprint(value: unknown) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  let memberClient;
  try { memberClient = await authenticatedClient(request); } catch { return json({ error: 'Function configuration is incomplete.' }, 500); }
  if (!memberClient) return json({ error: 'Member session is invalid or expired.' }, 401);
  const parsed = GroupMatchPayloadSchema.safeParse(await requestJson(request));
  if (!parsed.success) return json({ error: 'Group match request is invalid.' }, 400);
  const { data: membership } = await memberClient.from('trip_members').select('id').eq('trip_id', parsed.data.tripId).eq('active', true).maybeSingle();
  if (!membership) return json({ error: 'Trip Room access is unavailable.' }, 403);
  const url = Deno.env.get('SUPABASE_URL'); const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'Function configuration is incomplete.' }, 500);
  const service = createClient(url, serviceKey, { auth: { persistSession: false } });
  const [tripQuery, memberQuery, constraintQuery, roundQuery] = await Promise.all([
    service.from('trips').select('id,name,mode,constraints_locked_at').eq('id', parsed.data.tripId).single(),
    service.from('trip_members').select('id,display_name,display_name_discriminator').eq('trip_id', parsed.data.tripId).eq('active', true).order('created_at'),
    service.from('member_constraints').select('member_id,starts_on,ends_on,budget_min,budget_max,currency,max_travel_minutes,origin,accessibility_requirements,accessibility_visibility_consent,climate,visa_concern,transport,accommodation').eq('trip_id', parsed.data.tripId).order('member_id'),
    service.from('preference_rounds').select('id,kind,closed_at').eq('trip_id', parsed.data.tripId).order('sequence'),
  ]);
  if (tripQuery.error || memberQuery.error || constraintQuery.error || roundQuery.error) return json({ error: 'Could not load group inputs.' }, 500);
  if (!tripQuery.data.constraints_locked_at || roundQuery.data.length !== 5 || roundQuery.data.some((round) => !round.closed_at)) return json({ error: 'Complete and close all preference rounds before revealing the match.' }, 409);
  const roundIds = roundQuery.data.map((round) => round.id);
  const submissionQuery = await service.from('preference_submissions').select('round_id,member_id,value').in('round_id', roundIds).order('round_id').order('member_id');
  if (submissionQuery.error) return json({ error: 'Could not load preference inputs.' }, 500);
  const deterministic = deterministicResult({ trip: tripQuery.data, members: memberQuery.data, constraints: constraintQuery.data as Constraint[], rounds: roundQuery.data as Round[], submissions: submissionQuery.data as Submission[], generatedAt: new Date().toISOString() });
  const inputFingerprint = await fingerprint({ members: memberQuery.data, constraints: constraintQuery.data, rounds: roundQuery.data, submissions: submissionQuery.data });
  const ai = await requestGroqWording(deterministic.facts);
  const prose = ai ? { heading: ai.heading, summary: ai.summary, factWording: Object.fromEntries(ai.facts.map((fact) => [fact.factId, fact.wording])), source: 'groq' } : deterministic.prose;
  const stored = await service.from('recommendation_runs').upsert({ trip_id: parsed.data.tripId, status: deterministic.status, input_fingerprint: inputFingerprint, deterministic_result: deterministic, ai_wording: ai }, { onConflict: 'trip_id,input_fingerprint' }).select('id').single();
  if (stored.error) return json({ error: 'Could not save the group match.' }, 500);
  return json({ ...deterministic, runId: stored.data.id, prose });
});
