import { z } from 'zod';
import { LostIdentityError } from '@/lib/auth';

export type RecoveryKind = 'timeout' | 'invalid_schema' | 'no_match' | 'removed_member' | 'version_conflict' | 'identity_lost' | 'offline' | 'unknown';
export function recoveryKind(cause: unknown): RecoveryKind {
  if (cause instanceof LostIdentityError) return 'identity_lost';
  if (cause instanceof z.ZodError) return 'invalid_schema';
  const message = cause instanceof Error ? cause.message : String(cause ?? '');
  if (/version.conflict|changed in another session/i.test(message)) return 'version_conflict';
  if (/access is unavailable|active voter|membership.*removed/i.test(message)) return 'removed_member';
  if (/no valid match|no match remains/i.test(message)) return 'no_match';
  if (/timeout|timed out|abort/i.test(message)) return 'timeout';
  if (/network|offline|fetch failed/i.test(message)) return 'offline';
  return 'unknown';
}
export function recoveryMessage(kind: RecoveryKind) {
  const messages: Record<RecoveryKind, string> = {
    timeout: 'The request timed out. Your input is still here and can be retried safely.', invalid_schema: 'The response was not valid. Your input is unchanged; reload authoritative state and retry.', no_match: 'No valid match remains. Review the blocking inputs before trying again.', removed_member: 'This membership is no longer active. Rejoin with a current invitation.', version_conflict: 'Another session changed the itinerary. Reload the latest version; your requested change is retained.', identity_lost: 'This device can no longer recover the anonymous identity that joined the room.', offline: 'You appear to be offline. Your input is retained and the same operation will retry when connected.', unknown: 'The operation could not finish. Your input has been retained.',
  }; return messages[kind];
}
