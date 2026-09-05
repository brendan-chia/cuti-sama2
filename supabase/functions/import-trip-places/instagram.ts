/** Read public Instagram metadata only. Never execute page scripts or use login cookies. */
export function instagramPostUrl(input: string): string | null {
  const url = new URL(input);
  if (!['instagram.com', 'www.instagram.com'].includes(url.hostname) || url.protocol !== 'https:' || url.username || url.password || url.port) return null;
  const match = url.pathname.match(/^\/(?:[A-Za-z0-9_.]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]{1,64})\/?$/);
  return match ? `https://www.instagram.com/${match[1] === 'reels' ? 'reel' : match[1]}/${match[2]}/` : null;
}

function decodeEntities(text: string): string {
  const named: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
  return text.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (whole, entity: string) => {
    if (!entity.startsWith('#')) return named[entity.toLowerCase()] ?? whole;
    const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '';
  });
}

export function instagramCaption(html: string, expectedUrl: string): string {
  const metadata = new Map<string, string>();
  const markup = html.replace(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');
  for (const tag of markup.matchAll(/<meta\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi)) {
    const attributes = new Map<string, string>();
    for (const attribute of tag[0].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
      attributes.set(attribute[1].toLowerCase(), decodeEntities(attribute[2] ?? attribute[3] ?? attribute[4]));
    }
    const name = attributes.get('property') ?? attributes.get('name');
    if (name && attributes.has('content')) metadata.set(name.toLowerCase(), attributes.get('content')!);
  }
  // Reject generic login/profile pages or metadata belonging to a different post.
  const canonical = metadata.get('og:url');
  if (canonical) {
    try { if (instagramPostUrl(canonical) !== instagramPostUrl(expectedUrl)) return ''; } catch { return ''; }
  } else if (metadata.get('og:type') !== 'article') return '';
  for (const key of ['og:description', 'description', 'og:title']) {
    const text = metadata.get(key)?.trim();
    if (!text || /^(?:Instagram|Login\s*[•|–-]\s*Instagram|Log in to Instagram|Create an account|Join Instagram)\s*[.!]?$/i.test(text)) continue;
    // Instagram wraps the caption in author/date/engagement metadata.
    const caption = text.match(/:\s*["“]([\s\S]*)["”]\.?(?:\s*)$/)?.[1];
    if (caption?.trim()) return caption.trim().slice(0, 6000);
  }
  return '';
}

export async function readInstagramPost(input: string, fetcher = fetch): Promise<string> {
  const expected = instagramPostUrl(input);
  if (!expected) return '';
  let url = expected;
  for (let hop = 0; hop < 3; hop++) {
    const response = await fetcher(url, { redirect: 'manual', signal: AbortSignal.timeout(8000), headers: { Accept: 'text/html', 'Accept-Language': 'en' } });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      const location = response.headers.get('location');
      if (!location) return '';
      const next = new URL(location, url);
      if (instagramPostUrl(next.toString()) !== expected) return '';
      // Retain valid username paths; no cookies, credentials, arbitrary hosts or login redirects.
      next.search = ''; next.hash = ''; url = next.toString(); continue;
    }
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) { await response.body?.cancel(); return ''; }
    const reader = response.body?.getReader(); if (!reader) return '';
    const decoder = new TextDecoder(); let html = ''; let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > 2_000_000) { await reader.cancel(); return ''; }
        html += decoder.decode(value, { stream: true });
      }
      return instagramCaption(html + decoder.decode(), expected);
    } finally { reader.releaseLock(); }
  }
  return '';
}
