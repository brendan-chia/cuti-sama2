// Otter identity: leaf green, cocoa brown, warm paper and backpack orange.
export const colors = {
  background: '#F8F7EF', surface: '#FFFEFA', surfaceTint: '#EAF1D8',
  ink: '#563D2D', paper: '#FFFFFF',
  coral: '#AC4D10', coralPressed: '#883A0A', sand: '#F8E7BF',
  sky: '#4F7125', gold: '#86571E', sun: '#F6BB68',
  textMuted: '#776452', border: '#D7DDC5', danger: '#AE3C32',
  disabled: '#919582', overlay: 'rgba(248, 247, 239, 0.96)',
  leaf: '#8EBA46', orange: '#F58A24', cocoa: '#563D2D',
  // Compatibility aliases let all existing screens share the otter palette.
  midnight: '#F8F7EF', midnightRaised: '#FFFEFA', midnightSoft: '#EAF1D8', white: '#563D2D',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  hero: 48,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

export const typography = {
  display: 40,
  title: 28,
  heading: 19,
  body: 15,
  small: 12,
  label: 10,
} as const;
