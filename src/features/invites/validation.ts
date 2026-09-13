import { InviteTokenSchema } from '../../../packages/contracts/src/invite';
import type { CachedInvitation } from '../../../packages/contracts/src/invite';

export function extractInviteToken(value: string) {
  const trimmed = value.trim();
  const direct = InviteTokenSchema.safeParse(trimmed);
  if (direct.success) return direct.data;

  try {
    const url = new URL(trimmed);
    const segments = (url.protocol === 'cutisama2:' ? url.hostname + url.pathname : url.pathname).split('/').filter(Boolean);
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

/** The browser counterpart of an Expo Go development link on the same server. */
export function invitationBrowserUrl(invitation: CachedInvitation, appUrl: string) {
  try {
    const url = new URL(appUrl);
    if (url.protocol !== 'exp:' && url.protocol !== 'exps:') return null;
    const secure = url.protocol === 'exps:' || url.hostname.endsWith('.exp.direct');
    return invitationUrlForOrigin(invitation, (secure ? 'https://' : 'http://') + url.host);
  } catch {
    return null;
  }
}
