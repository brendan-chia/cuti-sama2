/** One URL and ingestion contract shared by the app, edge API and local worker. */
export type SocialVideo = {
  platform: 'instagram' | 'tiktok';
  sourceUrl: string;
  postId: string;
  caption: string;
  title: string;
  author: string;
  durationSeconds: number | null;
};

export function normalizeVideoUrl(input: string): { platform: SocialVideo['platform']; url: string } {
  const url = new URL(input.trim());
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('Use an Instagram or TikTok HTTPS video link.');
  if (['instagram.com', 'www.instagram.com'].includes(url.hostname)) {
    const match = url.pathname.match(/^\/(?:[^/]+\/)?(p|reels?|tv)\/([A-Za-z0-9_-]+)\/?$/);
    if (!match) throw new Error('Use an Instagram post or Reel link.');
    const canonical = new URL(`https://www.instagram.com/${match[1] === 'reels' ? 'reel' : match[1]}/${match[2]}/`);
    const imageIndex = url.searchParams.get('img_index');
    if (imageIndex && /^[1-9]\d?$/.test(imageIndex)) canonical.searchParams.set('img_index', imageIndex);
    return { platform: 'instagram', url: canonical.toString() };
  }
  if (['www.tiktok.com', 'tiktok.com', 'm.tiktok.com'].includes(url.hostname)
    && /^\/(?:@[^/]+\/video\/\d+|t\/[A-Za-z0-9_-]+)\/?$/.test(url.pathname)) {
    return { platform: 'tiktok', url: `https://www.tiktok.com${url.pathname}` };
  }
  if (['vm.tiktok.com', 'vt.tiktok.com'].includes(url.hostname) && /^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)) {
    return { platform: 'tiktok', url: `https://${url.hostname}${url.pathname}` };
  }
  throw new Error('Use an Instagram or TikTok video link.');
}

/** True for supported social media imports; media type is detected by the worker. */
export function isSocialVideoUrl(input: string): boolean {
  try { normalizeVideoUrl(input); return true; } catch { return false; }
}
