import type { PreferenceCardDefinition } from '../../../packages/contracts/src/preferences';

export const preferenceCards: PreferenceCardDefinition[] = [
  { kind: 'vibe', label: 'Vibe', example: 'e.g. quiet beach days with lively dinners', accessibleName: 'Vibe preference. Describe how you want the trip to feel.' },
  { kind: 'pace', label: 'Pace', example: 'e.g. one main activity each day', accessibleName: 'Pace preference. Describe how full or relaxed each day should be.' },
  { kind: 'must_have', label: 'Must-have', example: 'e.g. easy access to halal food', accessibleName: 'Must-have preference. Add one thing the trip needs to include.' },
  { kind: 'nice_to_have', label: 'Nice-to-have', example: 'e.g. a hotel pool or sunset view', accessibleName: 'Nice-to-have preference. Add something valuable but optional.' },
  { kind: 'avoid', label: 'Avoid / dealbreaker', example: 'e.g. overnight buses or shared bathrooms', accessibleName: 'Avoid or dealbreaker preference. Add something the trip must avoid.' },
];

export function preferenceCardFor(kind: PreferenceCardDefinition['kind']) {
  const card = preferenceCards.find((candidate) => candidate.kind === kind);
  if (!card) throw new Error(`Missing preference card for ${kind}.`);
  return card;
}

