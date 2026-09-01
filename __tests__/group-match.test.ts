import type { GroupMatchInput } from '../packages/contracts/src/group-match';
import { GroupMatchResultSchema } from '../packages/contracts/src/group-match';
import { applyAiWording, buildGroupMatch } from '@/domain/group-match';

const tripId = '67e3c78c-a1e0-41c2-9f1c-582ed656d777';
const memberIds = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];

function input(overrides: Partial<GroupMatchInput['members'][number]>[] = []): GroupMatchInput {
  return {
    tripId, tripName: 'Anywhere together', mode: 'shortlist', generatedAt: '2026-09-01T00:00:00Z',
    members: memberIds.map((memberId, index) => ({
      memberId, displayName: index ? 'Aina' : 'Organiser', discriminator: 1,
      constraints: {
        startsOn: '2026-12-01', endsOn: '2026-12-10', budgetMin: 1_000, budgetMax: 2_000, currency: 'MYR',
        maxTravelMinutes: 360, origin: 'Kuala Lumpur', accessibility: index ? 'Step-free access' : null,
        accessibilityVisibilityConsent: index === 1, climate: null, visa: null, transport: null, accommodation: null,
      },
      preferences: [
        { submissionId: `vibe-${index}`, kind: 'vibe', value: 'Quiet beach', groupVisible: true },
        { submissionId: `must-${index}`, kind: 'must_have', value: index ? 'Halal food' : 'Private room', groupVisible: true },
        { submissionId: `avoid-${index}`, kind: 'avoid', value: index ? 'Nightclubs' : 'Long bus rides', groupVisible: true },
      ],
      ...overrides[index],
    })),
  };
}

describe('deterministic group match golden fixtures', () => {
  it('identifies agreements, minority Must-haves, and dealbreakers without downgrading Avoid cards', () => {
    const result = buildGroupMatch(input());
    expect(result.status).toBe('matched');
    expect(result.facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'agreement', detail: 'Quiet beach' }),
      expect.objectContaining({ kind: 'minority_must_have', detail: 'Halal food' }),
      expect.objectContaining({ kind: 'dealbreaker', detail: 'Nightclubs' }),
    ]));
    expect(result.facts.filter((fact) => fact.detail === 'Nightclubs')).toHaveLength(1);
    expect(result.facts.find((fact) => fact.detail === 'Nightclubs')?.kind).toBe('dealbreaker');
    expect(() => GroupMatchResultSchema.parse(result)).not.toThrow();
  });

  it('only attributes structured constraint input when group visibility was consented to', () => {
    const result = buildGroupMatch(input([{ constraints: { ...input().members[0].constraints, climate: 'Cool weather' } }]));
    const climate = result.sources.find((source) => source.category === 'climate');
    const accessibility = result.sources.find((source) => source.category === 'accessibility');
    expect(climate).toMatchObject({ groupVisible: false, attribution: null, value: 'Cool weather' });
    expect(accessibility).toMatchObject({ groupVisible: true, attribution: 'Aina', value: 'Step-free access' });
  });

  it('returns blocking categories instead of a result when hard ranges have no intersection', () => {
    const conflicting = input([{}, { constraints: { ...input().members[1].constraints, startsOn: '2027-01-01', endsOn: '2027-01-10', budgetMin: 3_000, budgetMax: 4_000 } }]);
    const result = buildGroupMatch(conflicting);
    expect(result.status).toBe('blocked');
    expect(result.blockingCategories).toEqual(expect.arrayContaining(['dates', 'budget']));
    expect(result.prose.summary).toContain('No valid match remains');
  });

  it('does not let AI output add an unsupported conclusion or alter deterministic facts', () => {
    const result = buildGroupMatch(input());
    const adversarial = applyAiWording(result, { heading: 'Book Bali', summary: 'Bali is perfect', facts: [{ factId: 'agreement:invented', wording: 'Everyone chose Bali' }] });
    expect(adversarial).toBe(result);
    expect(adversarial.facts).toEqual(result.facts);
    expect(adversarial.nextAction).toEqual(result.nextAction);
  });
});
