import { createHash } from 'node:crypto';
import { readFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { command, prepareVideo } from './media.mjs';

export function visionBudgets(assets) {
  if (!assets.length || assets.length > 20 || assets.some(a => !['image', 'video'].includes(a.kind))) throw new Error('Choose a post with 1–20 photos or videos.');
  const videos = assets.filter(a => a.kind === 'video').length;
  const available = 20 - (assets.length - videos);
  let videoIndex = 0;
  return assets.map(a => a.kind === 'image' ? 1 : Math.floor(available / videos) + (videoIndex++ < available % videos ? 1 : 0));
}

export async function preparePost(assets, directory) {
  const budgets = visionBudgets(assets);
  const frames = []; const audios = []; const items = []; const hash = createHash('sha256');
  for (let itemIndex = 0; itemIndex < assets.length; itemIndex++) {
    const asset = assets[itemIndex];
    const itemDir = path.join(directory, `prepared-${itemIndex}`); await mkdir(itemDir, { recursive: true });
    if (asset.kind === 'video') {
      const media = await prepareVideo(asset.file, itemDir, budgets[itemIndex]);
      hash.update(media.hash);
      frames.push(...media.frames.map(frame => ({ ...frame, itemIndex, kind: 'video' })));
      audios.push({ itemIndex, file: media.audio });
      items.push({ kind: 'video', hasAudio: Boolean(media.audio) });
    } else {
      // Decode locally with FFmpeg before sending a bounded JPEG to vision.
      const probe = JSON.parse(await command('ffprobe', ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-show_streams', '-of', 'json', asset.file]));
      const stream = probe.streams?.[0];
      if (!stream || !(Number(stream.width) > 0 && Number(stream.height) > 0) || Number(stream.width) * Number(stream.height) > 40000000) throw new Error('Choose photos up to 40 megapixels.');
      const file = path.join(itemDir, 'photo.jpg');
      await command('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-protocol_whitelist', 'file,pipe', '-i', asset.file, '-frames:v', '1', '-vf', 'scale=1440:1440:force_original_aspect_ratio=decrease', '-q:v', '3', file]);
      if ((await stat(file)).size > 2000000) throw new Error('The prepared photo exceeds the image limit.');
      hash.update(await readFile(file));
      frames.push({ file, itemIndex, kind: 'image', seconds: 0 });
      items.push({ kind: 'image', hasAudio: false });
      audios.push({ itemIndex, file: null });
    }
  }
  const manifest = { items, frames: frames.map(({ itemIndex, kind, seconds }) => ({ itemIndex, kind, seconds })) };
  hash.update(JSON.stringify({ version: 3, manifest }));
  return { hash: hash.digest('hex'), manifest, frames, audios };
}
