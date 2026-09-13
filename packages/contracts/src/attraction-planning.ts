import type { TripVibe } from './trip-vibe';

export type AttractionPlanningMetadata = {
  countryId: string;
  estimatedDurationMinutes: number;
  /** Provisional per-person MYR allowance, never a fetched admission price. */
  estimatedCostMYR: number;
  vibes: TripVibe[];
  indoorOutdoor: 'indoor' | 'outdoor' | 'mixed';
  estimateBasis: 'category_allowance_v1';
  planningNote: string;
  requiresSpecialPlanning?: boolean;
};
type Profile = [minutes: number, allowanceMYR: number, setting: AttractionPlanningMetadata['indoorOutdoor'], vibes: TripVibe[]];
// Explicit hackathon assumptions, independent of operator links and live admission prices.
const profiles: Record<string, Profile> = {
  Shopping: [120, 0, 'indoor', ['lively', 'chill']],
  'Theme park': [420, 300, 'mixed', ['adventurous', 'lively']],
  City: [90, 100, 'mixed', ['balanced', 'lively']],
  Culture: [150, 80, 'mixed', ['quiet', 'balanced']],
  History: [180, 80, 'outdoor', ['quiet', 'balanced']],
  Nature: [240, 100, 'outdoor', ['quiet', 'adventurous']],
  Entertainment: [240, 250, 'mixed', ['lively', 'adventurous']],
  'Immersive art': [120, 150, 'indoor', ['balanced', 'lively']],
  'Cafes & shopping': [150, 50, 'mixed', ['chill', 'lively']],
  Food: [90, 60, 'mixed', ['lively', 'chill']],
  Adventure: [300, 200, 'outdoor', ['adventurous']],
  'Food & leisure': [150, 60, 'mixed', ['chill', 'balanced']],
  'Food & shopping': [150, 60, 'mixed', ['chill', 'lively']],
  'Science & design': [180, 150, 'indoor', ['balanced']],
};
// These representative points need boat, expedition or timed-event metadata first.
const specialPlanning = new Set([
  'jp-mount-fuji', 'id-komodo', 'ph-tubbataha', 'np-sagarmatha',
  'au-great-barrier-reef', 'vn-ha-long-bay', 'nz-milford-sound',
  'ph-underground-river', 'us-statue-of-liberty',
  'tw-raohe-night-market', 'la-vientiane-night-market', 'kh-phare-circus',
]);
const overrides: Record<string, Partial<Pick<AttractionPlanningMetadata, 'estimatedDurationMinutes' | 'estimatedCostMYR' | 'indoorOutdoor'>>> = {
  'my-exchange-trx': { indoorOutdoor: 'mixed' },
  'sg-jewel-changi': { estimatedCostMYR: 0, estimatedDurationMinutes: 150, indoorOutdoor: 'indoor' },
  'sg-merlion-park': { estimatedCostMYR: 0, estimatedDurationMinutes: 60, indoorOutdoor: 'outdoor' },
  'sg-botanic-gardens': { estimatedCostMYR: 0, estimatedDurationMinutes: 180 },
  'jp-fushimi-inari': { estimatedCostMYR: 0, indoorOutdoor: 'outdoor' },
  'jp-sensoji': { estimatedCostMYR: 0, estimatedDurationMinutes: 90 },
  'us-high-line': { estimatedCostMYR: 0, indoorOutdoor: 'outdoor' },
  'us-grand-canyon': { estimatedDurationMinutes: 420 },
  'us-yellowstone': { estimatedDurationMinutes: 480 },
  'nz-tongariro': { estimatedDurationMinutes: 480 },
};
export function bundledPlanningMetadata(id: string, countryId: string, category: string): AttractionPlanningMetadata {
  const profile = profiles[category];
  if (!profile) throw new Error(`Missing planning profile for ${category}.`);
  const [estimatedDurationMinutes, estimatedCostMYR, indoorOutdoor, vibes] = profile;
  return {
    countryId, estimatedDurationMinutes, estimatedCostMYR, indoorOutdoor, vibes: [...vibes],
    estimateBasis: 'category_allowance_v1',
    planningNote: 'Provisional category-based duration and activity allowance; verify tickets, opening hours and access. Not a live price. Shopping purchases, general meals and transport costs excluded.',
    ...overrides[id], requiresSpecialPlanning: specialPlanning.has(id),
  };
}
