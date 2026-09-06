import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stat } from 'node:fs/promises';
import { normalizeVideoUrl } from '../../packages/contracts/src/social-video.ts';
import { command } from './media.mjs';

const script = fileURLToPath(new URL('./ingest.py', import.meta.url));
export async function resolveVideoUrl(input, fetcher = fetch) {
  let source = normalizeVideoUrl(input);
  for (let hop = 0; hop < 4; hop++) {
    if (source.platform !== 'tiktok' || /\/@[^/]+\/video\/\d+/.test(new URL(source.url).pathname)) return source;
    const response = await fetcher(source.url, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
    await response.body?.cancel();
    const location = response.headers.get('location');
    if (!location) throw new Error('TikTok did not resolve this short link. Try the full video URL.');
    const next = normalizeVideoUrl(new URL(location, source.url).toString());
    if (next.platform !== 'tiktok') throw new Error('Unexpected TikTok redirect.');
    source = next;
  }
  throw new Error('TikTok redirected too many times. Try the full video URL.');
}

export async function ingestPost(sourceUrl, directory, python) {
  const source = await resolveVideoUrl(sourceUrl);
  const result = JSON.parse(await command(python, [script, 'metadata', source.platform, source.url, directory]));
  return { ...result, platform: source.platform, sourceUrl: source.url };
}

export async function downloadPost(post, directory, python) {
  await command(python, [script, 'download', post.platform, post.sourceUrl, directory]);
  const file = path.join(directory, 'video.mp4');
  const size = await stat(file).then(info => info.size).catch(() => 0);
  if (!size) throw new Error('No video was downloaded. The post may be unavailable or exceed 150 MB.');
  if (size > 157286400) throw new Error('Video exceeds 150 MB.');
  return file;
}
