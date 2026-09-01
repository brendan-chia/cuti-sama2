import { provenance, validateDestinationAnnotations } from '../_shared/provenance.ts';
function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }

Deno.test('catalogue evidence becomes stale after ninety days', () => {
  const fresh = provenance({ status: 'verified', field: 'Visa', observedAt: '2026-06-03T00:00:00Z' }, new Date('2026-09-01T00:00:00Z'));
  const stale = provenance({ status: 'verified', field: 'Visa', observedAt: '2026-06-02T23:59:59Z' }, new Date('2026-09-01T00:00:00Z'));
  assert(!fresh.stale && stale.stale, 'staleness boundary should be deterministic');
});

Deno.test('AI cannot add certainty, unknown destinations, invalid indexes, or excluded destinations', () => {
  const allowed = new Map([['catalogue:one', 2]]);
  assert(validateDestinationAnnotations({ destinations: [{ destinationId: 'catalogue:one', reasonOrder: [1, 0] }] }, allowed) !== null, 'valid order should pass');
  assert(validateDestinationAnnotations({ destinations: [], certainty: 'guaranteed safe' }, allowed) === null, 'certainty should fail strict schema');
  assert(validateDestinationAnnotations({ destinations: [{ destinationId: 'catalogue:excluded', reasonOrder: [] }] }, allowed) === null, 'excluded destination should fail');
  assert(validateDestinationAnnotations({ destinations: [{ destinationId: 'catalogue:one', reasonOrder: [2] }] }, allowed) === null, 'out-of-range reason should fail');
});

