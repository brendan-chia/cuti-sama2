/** Display formatting only: never rewrite provider IDs or persisted place records. */
const acronyms = new Set(['JR', 'KL', 'KLCC', 'KLIA', 'USA', 'UK', 'UAE', 'UNESCO', 'US', 'DC']);
export function placeLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ').replace(/[\p{L}][\p{L}\p{M}'’]*/gu, word => {
    if (acronyms.has(word.toUpperCase())) return word.toUpperCase();
    // Keep established mixed-case names such as teamLab and McDonald's.
    if (word !== word.toLowerCase() && word !== word.toUpperCase()) return word;
    const lower = word.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });
}
export function roundEstimateMinutes(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return Math.max(15, Math.round(minutes / 15) * 15);
}
export function estimatedDuration(minutes: number): string {
  const rounded = roundEstimateMinutes(minutes);
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return hours ? `${hours} ${hours === 1 ? 'hour' : 'hours'}${remainder ? ` ${remainder} min` : ''}` : `${rounded} min`;
}
