import { ensureAnonymousSession } from '@/lib/auth';
import { sessionStorage } from '@/lib/secure-storage';

async function key(tripId: string) {
  const session = await ensureAnonymousSession();
  if (!session.user) throw new Error('Please reopen your profile and try again.');
  return `inspiration-plan.${session.user.id}.${tripId}`;
}
export async function queueInspiration(tripId: string, inspirationId: string) {
  await sessionStorage.setItem(await key(tripId), inspirationId);
}
export async function pendingInspiration(tripId: string) {
  return sessionStorage.getItem(await key(tripId));
}
export async function clearPendingInspiration(tripId: string) {
  await sessionStorage.removeItem(await key(tripId));
}
export function inspirationSource(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host === 'instagram.com' || host.endsWith('.instagram.com')) return /\/reel\//.test(url) ? 'Instagram Reel' : 'Instagram';
    if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return 'TikTok';
    if (host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com')) return 'YouTube';
    return host;
  } catch { return 'Travel link'; }
}
