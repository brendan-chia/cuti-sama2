import type { CatalogueDestination, DestinationFilterConstraints } from '../packages/contracts/src/destination';
import { applyDestinationAnnotations, evaluateDestination, filterDestinations, minimumRevisionCategories } from '@/domain/destination-filter';
import { destinationConfidence, isEvidenceStale, withStaleness } from '@/domain/confidence';

const current = '2026-08-15T00:00:00Z';
const evidence = { status: 'verified' as const, label: 'Cost: Verified', sourceLabel: 'Catalogue', sourceUrl: null, observedAt: current, stale: false };
function candidate(overrides: Partial<CatalogueDestination> = {}): CatalogueDestination {
  return {
    catalogueId: '10000000-0000-4000-8000-000000000001', slug: 'da-nang-vietnam', name: 'Da Nang', country: 'Vietnam', countryCode: 'VN', enabled: true,
    estimate: { currency: 'MYR', minimum: 1_400, maximum: 2_400, evidence },
    travelTimes: [{ origin: 'Kuala Lumpur', minutes: 180, evidence }], interests: ['beaches', 'food'], climateTags: ['warm', 'tropical'], visaTags: ['visa-free'], accessibilityTags: ['step-free'], transportTags: ['direct flight'], accommodationTags: ['private room'], primaryCompromise: 'Busy in peak season',
    evidence: { visa: evidence, safety: evidence, openingHours: evidence, availability: evidence }, ...overrides,
  };
}
const constraints: DestinationFilterConstraints = { budgetMinimum: 1_000, budgetMaximum: 1_400, currency: 'MYR', origins: ['Kuala Lumpur'], maxTravelMinutes: 180, climateTerms: ['warm'], visaTerms: ['visa-free'], accessibilityTerms: ['step-free'], transportTerms: ['direct flight'], accommodationTerms: ['private room'], dealbreakerTerms: [] };

describe('destination filter truth table and boundaries', () => {
  it('includes exact budget and travel-time boundaries', () => {
    expect(evaluateDestination(candidate(), constraints)).toMatchObject({ eligible: true, failedCategories: [] });
  });
  it.each([
    ['budget', candidate({ estimate: { currency: 'MYR', minimum: 1_401, maximum: 2_400, evidence } })],
    ['travel_time', candidate({ travelTimes: [{ origin: 'Kuala Lumpur', minutes: 181, evidence }] })],
    ['climate', candidate({ climateTags: ['cool'] })],
    ['visa', candidate({ visaTags: ['visa required'] })],
    ['accessibility', candidate({ accessibilityTags: [] })],
    ['transport', candidate({ transportTags: [] })],
    ['accommodation', candidate({ accommodationTags: [] })],
    ['dealbreaker', candidate({ interests: ['nightclubs'] })],
  ] as const)('excludes a candidate that fails %s', (category, item) => {
    const applied = category === 'dealbreaker' ? { ...constraints, dealbreakerTerms: ['nightclubs'] } : constraints;
    expect(evaluateDestination(item, applied).failedCategories).toContain(category);
  });
  it('never returns disabled catalogue rows and returns at most the explicitly sliced eligible set', () => {
    expect(filterDestinations([candidate({ enabled: false }), candidate()], constraints)).toHaveLength(1);
  });
  it('finds the minimum category set that could unlock a catalogue candidate', () => {
    expect(minimumRevisionCategories([{ eligible: false, failedCategories: ['budget', 'travel_time'], matchReasons: [] }, { eligible: false, failedCategories: ['visa'], matchReasons: [] }])).toEqual(['visa']);
  });
});

describe('confidence and evidence', () => {
  it('marks evidence stale only after the 90-day boundary', () => {
    expect(isEvidenceStale('2026-06-03T00:00:00Z', new Date('2026-09-01T00:00:00Z'))).toBe(false);
    expect(isEvidenceStale('2026-06-02T23:59:59Z', new Date('2026-09-01T00:00:00Z'))).toBe(true);
  });
  it('lowers confidence for stale, unavailable, and unsupported evidence', () => {
    const stale = withStaleness({ ...evidence, observedAt: '2025-01-01T00:00:00Z' }, new Date('2026-09-01T00:00:00Z'));
    expect(destinationConfidence(true, [stale]).level).toBe('medium');
    expect(destinationConfidence(true, [{ ...stale, status: 'unavailable' }]).level).toBe('low');
    expect(destinationConfidence(false, [evidence]).warning).toContain('manual destination');
  });
});

describe('AI destination annotations', () => {
  const card = { destinationId: 'catalogue:one', catalogueId: candidate().catalogueId, name: 'Da Nang', country: 'Vietnam', supported: true, eligible: true, excludedBy: [], matchReasons: ['Budget fits', 'Travel fits'], estimate: candidate().estimate, travelTimes: candidate().travelTimes, interests: ['food'], primaryCompromise: 'Busy', confidence: { level: 'high' as const, label: 'High confidence', warning: null }, provenance: [evidence] };
  it('can only reorder existing reasons for eligible destinations', () => {
    expect(applyDestinationAnnotations([card], { destinations: [{ destinationId: card.destinationId, reasonOrder: [1, 0] }] })[0].matchReasons).toEqual(['Travel fits', 'Budget fits']);
  });
  it('rejects certainty claims, unknown destinations, and attempts to restore excluded destinations', () => {
    expect(applyDestinationAnnotations([card], { destinations: [], certainty: 'guaranteed safe' })).toEqual([card]);
    expect(applyDestinationAnnotations([card], { destinations: [{ destinationId: 'catalogue:invented', reasonOrder: [] }] })).toEqual([card]);
    expect(applyDestinationAnnotations([card], { destinations: [{ destinationId: card.destinationId, reasonOrder: [0] }] })).toEqual([card]);
    const excluded = { ...card, eligible: false, excludedBy: ['budget' as const] };
    expect(applyDestinationAnnotations([excluded], { destinations: [{ destinationId: excluded.destinationId, reasonOrder: [0] }] })).toEqual([excluded]);
  });
});
