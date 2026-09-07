/** Prioritize scene cuts and temporal coverage, capped at twenty vision calls. */
export function selectSceneFrames(times, scenes, duration, budget = 20) {
  if (!Number.isInteger(budget) || budget < 1 || budget > 20) throw new Error('Invalid scene budget.');
  if (!times.length || times.some(t => !Number.isFinite(t))) throw new Error('Invalid frame timestamps.');
  const target = Math.min(budget, times.length, Math.max(8, Math.min(20, Math.ceil(duration / 6))));
  const selected = new Map();
  const closest = seconds => {
    let best = 0;
    for (let i = 1; i < times.length; i++) if (Math.abs(times[i] - seconds) < Math.abs(times[best] - seconds)) best = i;
    return best;
  };
  const anchors = Math.min(4, target);
  for (let i = 0; i < anchors; i++) selected.set(closest(times.at(-1) * i / Math.max(1, anchors - 1)), 'coverage');
  for (const scene of scenes.filter(s => s.seconds >= 0 && s.seconds < duration).sort((a, b) => b.score - a.score || a.seconds - b.seconds)) {
    if (selected.size >= target) break;
    const index = closest(Math.min(times.at(-1), scene.seconds + 0.2));
    if (![...selected.keys()].some(i => Math.abs(times[i] - times[index]) < 0.4)) selected.set(index, 'scene-change');
  }
  while (selected.size < target) {
    let best = -1; let distance = -1;
    for (let i = 0; i < times.length; i++) {
      if (selected.has(i)) continue;
      const gap = Math.min(...[...selected.keys()].map(j => Math.abs(times[j] - times[i])));
      if (gap > distance) { best = i; distance = gap; }
    }
    if (best < 0) break;
    selected.set(best, 'coverage');
  }
  return [...selected].sort(([a], [b]) => a - b).map(([index, reason]) => ({ index, seconds: times[index], reason }));
}

export function parseScenes(text) {
  return [...text.matchAll(/pts_time:([\d.]+)[^\n]*\r?\n[^\n]*lavfi.scene_score=([\d.]+)/g)]
    .map(match => ({ seconds: Number(match[1]), score: Number(match[2]) }));
}
