/** Existing preference-card IDs; an empty group list means no revealed signal. */
export const tripVibes = ['quiet', 'chill', 'lively', 'adventurous', 'balanced'] as const;
export type TripVibe = typeof tripVibes[number];
