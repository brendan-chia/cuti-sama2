import type {
  AiMatchWording,
  GroupMatchInput,
  GroupMatchResult,
  MatchConstraintCategory,
  MatchFact,
  MatchSource,
} from '../../packages/contracts/src/group-match';
import { AiMatchWordingSchema, GroupMatchInputSchema, GroupMatchResultSchema } from '../../packages/contracts/src/group-match';

const labels: Record<MatchConstraintCategory, string> = {
  dates: 'travel dates', budget: 'budget', travel_time: 'travel time', origin: 'origin',
  accessibility: 'accessibility', climate: 'climate', visa: 'visa requirements',
  transport: 'transport', accommodation: 'accommodation', preference: 'preferences',
};

const normalized = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
const factToken = (value: string) => normalized(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'item';
const memberLabel = (member: GroupMatchInput['members'][number]) => `${member.displayName}${member.discriminator > 1 ? ` · ${member.discriminator}` : ''}`;

function nextAction(mode: GroupMatchInput['mode'], tripId: string): GroupMatchResult['nextAction'] {
  if (mode === 'shortlist') return { kind: 'compare_shortlist', label: 'Compare the shortlist', route: `/trip/${tripId}/destinations` };
  if (mode === 'undecided') return { kind: 'discover_destinations', label: 'Discover destinations', route: `/trip/${tripId}/destinations` };
  return { kind: 'generate_itinerary', label: 'Generate an itinerary', route: `/trip/${tripId}/itinerary` };
}

function constraintSource(
  member: GroupMatchInput['members'][number], category: MatchConstraintCategory, value: string,
): MatchSource {
  const visible = category === 'accessibility' && member.constraints.accessibilityVisibilityConsent;
  return {
    sourceId: `constraint:${member.memberId}:${category}`,
    memberId: member.memberId,
    attribution: visible ? memberLabel(member) : null,
    groupVisible: visible,
    inputKind: 'constraint', category, value,
  };
}

function findBlockingConstraints(input: GroupMatchInput, sources: MatchSource[], facts: MatchFact[]) {
  const blocking = new Set<MatchConstraintCategory>();
  const dated = input.members.filter((member) => member.constraints.startsOn && member.constraints.endsOn);
  if (dated.length > 1) {
    const start = dated.map((member) => member.constraints.startsOn!).sort().at(-1)!;
    const end = dated.map((member) => member.constraints.endsOn!).sort()[0];
    const sourceIds = dated.flatMap((member) => {
      const source = constraintSource(member, 'dates', `${member.constraints.startsOn} to ${member.constraints.endsOn}`);
      sources.push(source); return source.sourceId;
    });
    if (start > end) {
      blocking.add('dates');
      facts.push({ factId: 'conflict:dates', kind: 'unresolved_conflict', category: 'dates', title: 'Travel dates do not overlap', detail: 'The submitted date windows have no shared day.', sourceIds });
    } else {
      facts.push({ factId: 'agreement:dates', kind: 'agreement', category: 'dates', title: 'Shared travel window', detail: `${start} to ${end} works across the submitted date windows.`, sourceIds });
    }
  }

  const budgetGroups = new Map<string, typeof input.members>();
  for (const member of input.members) {
    if (member.constraints.budgetMin !== null && member.constraints.budgetMax !== null && member.constraints.currency) {
      budgetGroups.set(member.constraints.currency, [...(budgetGroups.get(member.constraints.currency) ?? []), member]);
    }
  }
  if (budgetGroups.size > 1) {
    const members = [...budgetGroups.values()].flat();
    const sourceIds = members.map((member) => {
      const c = member.constraints;
      const source = constraintSource(member, 'budget', `${c.currency} ${c.budgetMin}–${c.budgetMax}`); sources.push(source); return source.sourceId;
    });
    blocking.add('budget');
    facts.push({ factId: 'conflict:budget-currency', kind: 'unresolved_conflict', category: 'budget', title: 'Budget currencies are unresolved', detail: 'The submitted budgets use different currencies and cannot be compared without an agreed conversion.', sourceIds });
  } else {
    for (const [currency, members] of budgetGroups) {
      if (members.length < 2) continue;
      const minimum = Math.max(...members.map((member) => member.constraints.budgetMin!));
      const maximum = Math.min(...members.map((member) => member.constraints.budgetMax!));
      const sourceIds = members.map((member) => {
        const c = member.constraints;
        const source = constraintSource(member, 'budget', `${currency} ${c.budgetMin}–${c.budgetMax}`); sources.push(source); return source.sourceId;
      });
      if (minimum > maximum) {
        blocking.add('budget');
        facts.push({ factId: 'conflict:budget', kind: 'unresolved_conflict', category: 'budget', title: 'Budgets do not overlap', detail: 'The submitted budget ranges have no shared amount.', sourceIds });
      } else {
        facts.push({ factId: 'agreement:budget', kind: 'agreement', category: 'budget', title: 'Shared budget range', detail: `${currency} ${minimum}–${maximum} fits every submitted budget.`, sourceIds });
      }
    }
  }

  const textCategories = ['origin', 'accessibility', 'climate', 'visa', 'transport', 'accommodation'] as const;
  for (const category of textCategories) {
    for (const member of input.members) {
      const value = member.constraints[category];
      if (!value) continue;
      const source = constraintSource(member, category, value);
      sources.push(source);
      facts.push({
        factId: `agreement:${category}:${factToken(value)}:${member.memberId.slice(0, 8)}`,
        kind: 'agreement', category, title: `${labels[category][0].toUpperCase()}${labels[category].slice(1)} to respect`,
        detail: value, sourceIds: [source.sourceId],
      });
    }
  }
}

function preferenceFacts(input: GroupMatchInput, sources: MatchSource[], facts: MatchFact[]) {
  const byKind = new Map<string, Map<string, { value: string; sources: MatchSource[] }>>();
  for (const member of input.members) for (const preference of member.preferences) {
    if (!preference.groupVisible) continue;
    const source: MatchSource = {
      sourceId: `preference:${preference.submissionId}`, memberId: member.memberId,
      attribution: memberLabel(member), groupVisible: true, inputKind: 'preference', category: 'preference', value: preference.value,
    };
    sources.push(source);
    const groups = byKind.get(preference.kind) ?? new Map();
    const key = normalized(preference.value);
    const group = groups.get(key) ?? { value: preference.value, sources: [] };
    group.sources.push(source); groups.set(key, group); byKind.set(preference.kind, groups);
  }

  const count = input.members.length;
  for (const [kind, groups] of byKind) for (const [key, group] of groups) {
    const sourceIds = group.sources.map((source) => source.sourceId);
    if (kind === 'avoid') {
      facts.push({ factId: `dealbreaker:${factToken(key)}`, kind: 'dealbreaker', category: 'preference', title: 'Dealbreaker', detail: group.value, sourceIds });
    } else if (kind === 'must_have' && group.sources.length < count) {
      facts.push({ factId: `minority:${factToken(key)}`, kind: 'minority_must_have', category: 'preference', title: 'Minority Must-have', detail: group.value, sourceIds });
    } else if (group.sources.length >= 2 || count === 1) {
      facts.push({ factId: `agreement:${kind}:${factToken(key)}`, kind: 'agreement', category: 'preference', title: kind === 'must_have' ? 'Shared Must-have' : 'Common preference', detail: group.value, sourceIds });
    }
  }

  for (const kind of ['vibe', 'pace'] as const) {
    const groups = byKind.get(kind);
    if (!groups || groups.size < 2 || [...groups.values()].some((group) => group.sources.length >= 2)) continue;
    const sourceIds = [...groups.values()].flatMap((group) => group.sources.map((source) => source.sourceId));
    facts.push({ factId: `conflict:${kind}`, kind: 'unresolved_conflict', category: 'preference', title: `${kind === 'vibe' ? 'Vibe' : 'Pace'} is still unresolved`, detail: `The group submitted different ${kind} preferences without a common choice.`, sourceIds });
  }
}

export function buildGroupMatch(rawInput: GroupMatchInput): GroupMatchResult {
  const input = GroupMatchInputSchema.parse(rawInput);
  const sources: MatchSource[] = [];
  const facts: MatchFact[] = [];
  findBlockingConstraints(input, sources, facts);
  preferenceFacts(input, sources, facts);
  const blockingCategories = [...new Set(facts.filter((fact) => fact.kind === 'unresolved_conflict' && fact.category !== 'preference' && ['dates', 'budget'].includes(fact.category)).map((fact) => fact.category))];
  const status = blockingCategories.length ? 'blocked' as const : 'matched' as const;
  const heading = status === 'blocked' ? 'The group needs one more decision' : 'Here’s where the group aligns';
  const summary = status === 'blocked'
    ? `No valid match remains until the group resolves: ${blockingCategories.map((category) => labels[category]).join(', ')}.`
    : 'This reveal is calculated only from the group’s submitted constraints and revealed preference cards.';
  return GroupMatchResultSchema.parse({
    runId: null, tripId: input.tripId, tripName: input.tripName, mode: input.mode, status, facts, sources,
    blockingCategories, nextAction: nextAction(input.mode, input.tripId), generatedAt: input.generatedAt,
    prose: { heading, summary, factWording: {}, source: 'deterministic' },
  });
}

export function applyAiWording(result: GroupMatchResult, candidate: unknown): GroupMatchResult {
  const parsed = AiMatchWordingSchema.safeParse(candidate);
  if (!parsed.success) return result;
  const knownFacts = new Set(result.facts.map((fact) => fact.factId));
  if (parsed.data.facts.some((fact) => !knownFacts.has(fact.factId))) return result;
  const factWording = Object.fromEntries(parsed.data.facts.map((fact) => [fact.factId, fact.wording]));
  return GroupMatchResultSchema.parse({ ...result, prose: { heading: parsed.data.heading, summary: parsed.data.summary, factWording, source: 'groq' } });
}

export function parseAiMatchWording(value: unknown): AiMatchWording | null {
  const parsed = AiMatchWordingSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
