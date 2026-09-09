import { logisticsDraftNotice } from '../../../packages/contracts/src/logistics.ts';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { requestAiItinerary, ItineraryGenerationError, type AiItinerary } from '../_shared/groq.ts';
import { questItineraryInput, questItineraryConflicts } from './quest-input.ts';
import { authenticatedClient, corsHeaders, json, requestJson } from '../_shared/invites.ts';

const PayloadSchema = z.object({ tripId: z.uuid(), idempotencyKey: z.uuid() }).strict();
type Constraint = { member_id: string; budget_max: number | null; currency: string | null; max_travel_minutes: number | null; accessibility_requirements: string | null; accessibility_visibility_consent: boolean; starts_on: string | null; ends_on: string | null; updated_at: string };
type Round = { id: string; kind: 'vibe' | 'pace' | 'must_have' | 'nice_to_have' | 'avoid'; closed_at: string | null };
type Submission = { round_id: string; value: string; pace_value: number | null; updated_at: string };
type HardConstraints = { budgetMaximum: number | null; currency: string | null; accessibilityRequirements: string[]; dealbreakers: string[]; maxTravelMinutes: number | null; startsOn: string | null; endsOn: string | null };

const normalize = (value: string) => value.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const useful = (value: string | null) => value && !['none', 'no', 'n a', 'no requirements'].includes(normalize(value)) ? value : null;

function hardConstraints(rows: Constraint[], dealbreakers: string[], tripDates: { startsOn: string | null; endsOn: string | null }): HardConstraints {
  const budgets = rows.filter((row) => row.budget_max !== null && row.currency);
  const currencies = new Set(budgets.map((row) => row.currency!));
  return {
    budgetMaximum: budgets.length && currencies.size === 1 ? Math.min(...budgets.map((row) => Number(row.budget_max))) : null,
    currency: currencies.size === 1 ? [...currencies][0] : currencies.size > 1 ? 'MIX' : null,
    accessibilityRequirements: [...new Set(rows.map((row) => useful(row.accessibility_requirements)).filter((value): value is string => Boolean(value)))],
    dealbreakers: [...new Set(dealbreakers.filter((value) => Boolean(useful(value))))],
    maxTravelMinutes: rows.some((row) => row.max_travel_minutes !== null) ? Math.min(...rows.map((row) => row.max_travel_minutes).filter((value): value is number => value !== null)) : null,
    startsOn: tripDates.startsOn ?? rows.map((row) => row.starts_on).filter((value): value is string => value !== null).sort().at(-1) ?? null,
    endsOn: tripDates.endsOn ?? rows.map((row) => row.ends_on).filter((value): value is string => value !== null).sort()[0] ?? null,
  };
}

function conflicts(draft: AiItinerary, constraints: HardConstraints) {
  const result: string[] = []; const activities = draft.days.flatMap((day) => day.activities);
  if (constraints.budgetMaximum !== null && constraints.currency) {
    if (activities.some((item) => item.estimate.currency !== constraints.currency || item.estimate.basis !== 'per_person')) result.push(`All estimates must use comparable per-person ${constraints.currency} amounts.`);
    else if (activities.reduce((total, item) => total + item.estimate.maximum, 0) > constraints.budgetMaximum) result.push('The itinerary exceeds the group budget.');
  }
  if (constraints.startsOn || constraints.endsOn) for (const day of draft.days) {
    if (!day.date || (constraints.startsOn && day.date < constraints.startsOn) || (constraints.endsOn && day.date > constraints.endsOn)) result.push(`Day ${day.dayNumber}: outside the locked travel dates.`);
  }
  const access = constraints.accessibilityRequirements.map(normalize);
  if (access.length) for (const item of activities) {
    const evidence = normalize([...item.accessibility.features, item.accessibility.notes ?? ''].join(' '));
    if (item.accessibility.status !== 'confirmed' || access.some((term) => !evidence.includes(term))) result.push(`${item.activityId}: accessibility requirements are not confirmed.`);
  }
  for (const item of activities) {
    const searchable = normalize([item.title, item.description, item.location.name, item.location.address ?? '', ...item.tags].join(' '));
    if (constraints.dealbreakers.some((value) => searchable.includes(normalize(value)))) result.push(`${item.activityId}: recorded dealbreaker conflict.`);
    if (constraints.maxTravelMinutes !== null && item.travelMinutes !== null && item.travelMinutes > constraints.maxTravelMinutes) result.push(`${item.activityId}: maximum travel time exceeded.`);
  }
  return result;
}

function outputIsSafe(draft: AiItinerary, input: { destination: { name: string; country: string | null }; privateValues: string[]; sourceTimestamps: string[] }) {
  if (normalize(draft.destination.name) !== normalize(input.destination.name) || normalize(draft.destination.country ?? '') !== normalize(input.destination.country ?? '')) return false;
  const output = normalize(JSON.stringify(draft));
  if (input.privateValues.filter((value) => normalize(value).length >= 8).some((value) => output.includes(normalize(value)))) return false;
  const groupExplanation = draft.days.flatMap((day) => day.activities).some((item) => /\b(group|shared|preference|pace|budget|accessibility|must have|nice to have|vibe)\b/.test(normalize(item.rationale.explanation)));
  if (!groupExplanation) return false;
  const allowed = new Set(input.sourceTimestamps);
  return draft.sourceTimestamps.every((value) => allowed.has(value)) && draft.days.every((day) => day.activities.every((activity) => activity.sourceTimestamps.every((value) => allowed.has(value)) && allowed.has(activity.estimate.sourceTimestamp)));
}

async function fail(service: SupabaseClient, operationId: string, lease: string, message: string) {
  await service.from('itinerary_generation_operations').update({ status: 'failed', error: message.slice(0, 500), completed_at: new Date().toISOString() }).eq('id', operationId).eq('lease', lease).eq('status', 'pending');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  let memberClient; try { memberClient = await authenticatedClient(request); } catch { return json({ error: 'Function configuration is incomplete.' }, 500); }
  if (!memberClient) return json({ error: 'Member session is invalid or expired.' }, 401);
  const parsed = PayloadSchema.safeParse(await requestJson(request)); if (!parsed.success) return json({ error: 'Itinerary request is invalid.' }, 400);
  const { data: identity, error: identityError } = await memberClient.auth.getUser();
  if (identityError || !identity.user) return json({ error: 'Member session is invalid or expired.' }, 401);
  const { data: membership, error: membershipError } = await memberClient.from('trip_members').select('id,role').eq('trip_id', parsed.data.tripId).eq('user_id', identity.user.id).eq('active', true).maybeSingle();
  if (membershipError || !membership) return json({ error: 'Trip Room access is unavailable.' }, 403);
  if (membership.role !== 'organizer') return json({ error: 'Only the organiser can generate the itinerary.' }, 403);
  const url = Deno.env.get('SUPABASE_URL'); const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'Function configuration is incomplete.' }, 500);
  const service = createClient(url, serviceKey, { auth: { persistSession: false } });

  const prepared = await memberClient.rpc('prepare_quest_itinerary', { p_trip_id: parsed.data.tripId });
  if (prepared.error) return json({ error: prepared.error.message }, 409);
  let questInput: ReturnType<typeof questItineraryInput> | null = null;
  if (prepared.data) {
    if (prepared.data.room.currentRole !== 'organizer') return json({ error: 'The organiser generates the shared itinerary.' }, 403);
    try { questInput = questItineraryInput(prepared.data.room, prepared.data.updatedAt); }
    catch (cause) { return json({ error: cause instanceof Error ? cause.message : 'The group plan is incomplete.' }, 409); }
  }

  const operation = await service.rpc('claim_itinerary_generation', { p_trip_id: parsed.data.tripId, p_member_id: membership.id, p_key: parsed.data.idempotencyKey });
  if (operation.error || !operation.data) return json({ error: 'Could not begin itinerary generation.' }, 500);
  if (operation.data.status === 'pending') return json({ error: 'The itinerary is still being generated. Wait for the current request to finish, then refresh.' }, 409);
  if (operation.data.status === 'completed') {
    const existing = await service.from('itinerary_versions').select('id,version_number,generated_at,content,input_snapshot').eq('operation_id', operation.data.id).single();
    if (questInput && existing.data?.input_snapshot?.questRevision !== questInput.questRevision) return json({ error: 'This request belongs to an older group plan. Reopen the itinerary to generate the current plan.' }, 409);
    if (!existing.error) return json({ tripId: parsed.data.tripId, version: { versionId: existing.data.id, version: existing.data.version_number, generatedAt: existing.data.generated_at, itinerary: existing.data.content } });
    return json({ error: 'Could not restore the completed itinerary. Refresh and try again.' }, 500);
  }
  const operationId = operation.data.id;
  const lease = operation.data.lease;

  const [tripQuery, constraintQuery, roundQuery] = await Promise.all([
    service.from('trips').select('id,name,starts_on,ends_on,locked_destination_option_id,locked_destination_name,locked_destination_country,destination_locked_at').eq('id', parsed.data.tripId).single(),
    service.from('member_constraints').select('member_id,budget_max,currency,max_travel_minutes,accessibility_requirements,accessibility_visibility_consent,starts_on,ends_on,updated_at').eq('trip_id', parsed.data.tripId).order('member_id'),
    service.from('preference_rounds').select('id,kind,closed_at').eq('trip_id', parsed.data.tripId).order('sequence'),
  ]);
  if (tripQuery.error || constraintQuery.error || roundQuery.error) { await fail(service, operationId, lease, 'Could not load group inputs.'); return json({ error: 'Could not load group inputs.' }, 500); }
  const trip = tripQuery.data;
  if (!trip.destination_locked_at || !trip.locked_destination_option_id || !trip.locked_destination_name) { await fail(service, operationId, lease, 'Lock a destination before generating an itinerary.'); return json({ error: 'Lock a destination before generating an itinerary.' }, 409); }
  const roundIds = roundQuery.data.filter((round) => round.closed_at).map((round) => round.id);
  const submissionQuery = roundIds.length ? await service.from('preference_submissions').select('round_id,value,pace_value,updated_at').in('round_id', roundIds).order('round_id') : { data: [] as Submission[], error: null };
  if (submissionQuery.error) { await fail(service, operationId, lease, 'Could not load group preferences.'); return json({ error: 'Could not load group preferences.' }, 500); }
  const rounds = roundQuery.data as Round[]; const submissions = submissionQuery.data as Submission[]; const roundById = new Map(rounds.map((round) => [round.id, round]));
  const groupedSignals = submissions.filter((item) => roundById.get(item.round_id)?.kind !== 'avoid').map((item) => ({ kind: roundById.get(item.round_id)?.kind, value: item.value, paceValue: item.pace_value }));
  const dealbreakers = submissions.filter((item) => roundById.get(item.round_id)?.kind === 'avoid').map((item) => item.value);
  const constraints = constraintQuery.data as Constraint[]; const hard = questInput?.hardConstraints ?? hardConstraints(constraints, dealbreakers, { startsOn: trip.starts_on, endsOn: trip.ends_on });
  if (hard.currency === 'MIX' || (hard.startsOn && hard.endsOn && hard.startsOn > hard.endsOn)) {
    await fail(service, operationId, lease, 'Group hard constraints are internally incompatible.');
    return json({ error: 'Resolve the group’s budget currency or travel-date conflict before generating an itinerary.' }, 409);
  }
  const sourceTimestamps = questInput?.sourceTimestamps ?? [...new Set([trip.destination_locked_at, ...constraints.map((row) => row.updated_at), ...submissions.map((row) => row.updated_at)])];
  const destination = questInput?.destination ?? { name: trip.locked_destination_name, country: trip.locked_destination_country };
  const inputSnapshot = questInput ?? { destination, dates: { startsOn: trip.starts_on, endsOn: trip.ends_on }, hardConstraints: hard, groupSignals: groupedSignals, sourceTimestamps };
  let draft: AiItinerary | null;
  try { draft = await requestAiItinerary(inputSnapshot); }
  catch (cause) {
    const message = cause instanceof ItineraryGenerationError ? cause.message : 'The AI service could not complete the itinerary. Please retry.';
    await fail(service, operationId, lease, message);
    return json({ error: message }, cause instanceof ItineraryGenerationError ? cause.status : 503);
  }
  if (!draft) { await fail(service, operationId, lease, 'The AI response was unavailable or malformed.'); return json({ error: 'The itinerary draft was not schema-valid. Retry generation.' }, 502); }
  if (questInput?.logistics.draft) {
    draft.summary = `Draft itinerary. ${draft.summary}`.slice(0, 800);
    draft.warnings = [logisticsDraftNotice, ...draft.warnings.filter((warning) => warning !== logisticsDraftNotice)].slice(0, 20);
  }
  const privateValues = questInput ? [] : constraints.filter((row) => !row.accessibility_visibility_consent && useful(row.accessibility_requirements)).map((row) => row.accessibility_requirements!);
  if (!outputIsSafe(draft, { destination, privateValues, sourceTimestamps })) { await fail(service, operationId, lease, 'The AI response failed provenance or privacy validation.'); return json({ error: 'The itinerary draft failed safety validation. Retry generation.' }, 422); }
  const found = [...conflicts(draft, hard), ...(questInput ? questItineraryConflicts(draft, questInput) : [])];
  if (found.length) { await fail(service, operationId, lease, `Hard-constraint conflict: ${found.join(' ').slice(0, 450)}`); return json({ error: 'The generated draft conflicted with a hard constraint or dealbreaker. Nothing was saved.' }, 422); }
  const stored = await service.rpc('store_claimed_itinerary', { p_operation_id: operationId, p_lease: lease, p_destination_option_id: trip.locked_destination_option_id, p_destination_locked_at: trip.destination_locked_at, p_content: draft, p_input_snapshot: inputSnapshot });
  if (stored.error) { await fail(service, operationId, lease, stored.error.message); return json({ error: stored.error.code === '22023' ? stored.error.message : 'Could not save the itinerary.' }, stored.error.code === '22023' ? 409 : 500); }
  return json({ tripId: parsed.data.tripId, version: stored.data });
});
