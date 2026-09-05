import { InviteTokenSchema } from '../../../packages/contracts/src/invite';
import type { CachedInvitation } from '../../../packages/contracts/src/invite';

export function extractInviteToken(value: string) {
  const trimmed = value.trim();
  const direct = InviteTokenSchema.safeParse(trimmed);
  if (direct.success) return direct.data;

  try {
    const url = new URL(trimmed);
    const segments = url.pathname.split('/').filter(Boolean);
    const inviteIndex = segments.lastIndexOf('invite');
    const token = inviteIndex >= 0 ? segments[inviteIndex + 1] : undefined;
    const parsed = InviteTokenSchema.safeParse(token);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function invitationUrlForOrigin(invitation: CachedInvitation, origin?: string | null) {
  if (!origin) return invitation.inviteUrl;
  try {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol)) return invitation.inviteUrl;
    return `${url.origin}/invite/${encodeURIComponent(invitation.token)}`;
  } catch {
    return invitation.inviteUrl;
  }
}
