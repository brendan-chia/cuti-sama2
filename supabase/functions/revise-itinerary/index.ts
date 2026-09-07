import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { requestAiItineraryRevision, AiItinerarySchema, type AiItinerary } from '../_shared/groq.ts';
import { diffItineraries } from '../_shared/itinerary-diff.ts';
import { authenticatedClient, corsHeaders, json, requestJson } from '../_shared/invites.ts';

const InstructionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('pace'), pace: z.enum(['relaxed', 'balanced', 'full']) }).strict(),
  z.object({ kind: z.literal('replace_activity'), activityId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/), replacementBrief: z.string().trim().min(3).max(240) }).strict(),
  z.object({ kind: z.literal('budget_cap'), amount: z.number().positive().max(1_000_000), currency: z.string().regex(/^[A-Z]{3}$/) }).strict(),
]);
const PayloadSchema = z.object({ tripId: z.uuid(), baseVersionId: z.uuid(), idempotencyKey: z.uuid(), instruction: InstructionSchema }).strict();

function bounded(base: AiItinerary, candidate: AiItinerary, instruction: z.infer<typeof InstructionSchema>) {
  if (JSON.stringify(base.destination) !== JSON.stringify(candidate.destination)) return false;
  if (base.days.length !== candidate.days.length || base.days.some((day, index) => day.dayNumber !== candidate.days[index]?.dayNumber || day.date !== candidate.days[index]?.date)) return false;
  const diff = diffItineraries(base, candidate);
  if (diff.changedDays.length === 0) return false;
  if (instruction.kind === 'replace_activity') {
    const source = base.days.flatMap((day) => day.activities).find((item) => item.activityId === instruction.activityId);
    if (!source) return false;
    const changed = diff.changedDays.flatMap((day) => day.activityChanges);
    if (!changed.some((item) => item.activityId === instruction.activityId)) return false;
  }
  if (instruction.kind === 'budget_cap') {
    const activities = candidate.days.flatMap((day) => day.activities);
    if (activities.some((item) => item.estimate.currency !== instruction.currency || item.estimate.basis !== 'per_person')) return false;
    if (activities.reduce((sum, item) => sum + item.estimate.maximum, 0) > instruction.amount) return false;
  }
  return true;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  let memberClient; try { memberClient = await authenticatedClient(request); } catch { return json({ error: 'Function configuration is incomplete.' }, 500); }
  if (!memberClient) return json({ error: 'Member session is invalid or expired.' }, 401);
  const parsed = PayloadSchema.safeParse(await requestJson(request)); if (!parsed.success) return json({ error: 'Revision request is invalid.' }, 400);
  const begun = await memberClient.rpc('begin_itinerary_revision', { p_trip_id: parsed.data.tripId, p_base_version_id: parsed.data.baseVersionId, p_idempotency_key: parsed.data.idempotencyKey, p_instruction: parsed.data.instruction });
  if (begun.error) return json({ error: begun.error.message === 'VERSION_CONFLICT' ? 'VERSION_CONFLICT' : begun.error.message }, begun.error.message === 'VERSION_CONFLICT' ? 409 : begun.error.code === '42501' ? 403 : 400);
  const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  if (begun.data.status === 'ready') {
    const existing = await service.from('itinerary_revision_operations').select('id,base_version_id,status,instruction,semantic_diff,result:itinerary_versions!itinerary_revision_result_fk(id,version_number,generated_at,content)').eq('id', begun.data.operationId).single();
    if (!existing.error && existing.data.result) { const result = existing.data.result as unknown as { id: string; version_number: number; generated_at: string; content: AiItinerary }; return json({ tripId: parsed.data.tripId, preview: { revisionId: existing.data.id, baseVersionId: existing.data.base_version_id, status: 'ready', instruction: existing.data.instruction, candidate: { versionId: result.id, version: result.version_number, generatedAt: result.generated_at, itinerary: result.content }, diff: existing.data.semantic_diff } }); }
  }
  const base = AiItinerarySchema.safeParse(begun.data.base?.itinerary);
  if (!base.success) return json({ error: 'Stored base itinerary is invalid.' }, 500);
  const candidate = await requestAiItineraryRevision(base.data, parsed.data.instruction);
  if (!candidate || !bounded(base.data, candidate, parsed.data.instruction)) {
    await service.from('itinerary_revision_operations').update({ status: 'failed', error: 'The revision was not safely bounded.', completed_at: new Date().toISOString() }).eq('id', begun.data.operationId);
    return json({ error: 'The revision could not be safely applied. Try a more specific request.' }, 422);
  }
  const diff = diffItineraries(base.data, candidate);
  const stored = await service.rpc('store_revised_itinerary', { p_operation_id: begun.data.operationId, p_content: candidate, p_semantic_diff: diff });
  if (stored.error) return json({ error: stored.error.message === 'VERSION_CONFLICT' ? 'VERSION_CONFLICT' : 'Could not save the revision.' }, stored.error.message === 'VERSION_CONFLICT' ? 409 : 500);
  const persisted = await service.from('itinerary_revision_operations').select('semantic_diff').eq('id', begun.data.operationId).single();
  return json({ tripId: parsed.data.tripId, preview: { revisionId: begun.data.operationId, baseVersionId: parsed.data.baseVersionId, status: 'ready', instruction: parsed.data.instruction, candidate: stored.data, diff: persisted.data?.semantic_diff ?? diff } });
});
