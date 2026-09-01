import type { DestinationConfidence, Evidence } from '../../packages/contracts/src/destination';

export const EVIDENCE_STALE_AFTER_DAYS = 90;

export function isEvidenceStale(observedAt: string | null, asOf: Date, staleAfterDays = EVIDENCE_STALE_AFTER_DAYS) {
  if (!observedAt) return true;
  const age = asOf.getTime() - new Date(observedAt).getTime();
  return !Number.isFinite(age) || age > staleAfterDays * 24 * 60 * 60 * 1_000;
}

export function withStaleness(evidence: Omit<Evidence, 'stale'> & { stale?: boolean }, asOf: Date): Evidence {
  return { ...evidence, stale: evidence.status !== 'verified' || isEvidenceStale(evidence.observedAt, asOf) };
}

export function destinationConfidence(supported: boolean, evidence: Evidence[]): DestinationConfidence {
  if (!supported) return { level: 'low', label: 'Low confidence', warning: 'This manual destination is not in the launch catalogue. Cost, travel, visa, safety, opening-hour, and availability details may be unavailable.' };
  if (evidence.some((item) => item.status === 'unavailable')) return { level: 'low', label: 'Low confidence', warning: 'Some decision-critical data is unavailable.' };
  if (evidence.some((item) => item.status === 'estimated' || item.stale)) return { level: 'medium', label: 'Medium confidence', warning: 'Some evidence is estimated or may be out of date.' };
  return { level: 'high', label: 'High confidence', warning: null };
}

