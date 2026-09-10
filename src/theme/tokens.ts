// Palette from assets/images/yellow otter.png: leaf, cocoa, cream and orange.
export const colors = {
  background: '#FAFAF6', surface: '#FFFFFF', surfaceTint: '#EDF4DB',
  ink: '#263128', paper: '#FFFFFF',
  coral: '#A64B08', coralPressed: '#813805', sand: '#FCE6BE',
  sky: '#4F7027', gold: '#85571F', sun: '#F6C777',
  textMuted: '#566052', border: '#D9DFC5', danger: '#AE3C32',
  disabled: '#66705F', overlay: 'rgba(250, 250, 246, 0.96)',
  leaf: '#91B947', orange: '#F58A20', cocoa: '#5B402E',
  // Compatibility aliases let all existing screens share the otter palette.
  midnight: '#FAFAF6', midnightRaised: '#FFFFFF', midnightSoft: '#EDF4DB', white: '#263128',
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
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  display: 40,
  title: 28,
  heading: 20,
  body: 16,
  small: 14,
  label: 12,
} as const;
