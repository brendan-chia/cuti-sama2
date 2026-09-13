// Palette from assets/images/yellow otter.png: leaf, cocoa, cream and orange.
export const colors = {
  background: '#FFFBF3', surface: '#FFF6E8', surfaceTint: '#EDF4DB',
  ink: '#593D2C', paper: '#FFFBF3',
  coral: '#A64B08', coralPressed: '#813805', sand: '#FCE6BE',
  sky: '#4F7027', gold: '#85571F', sun: '#F6C777',
  textMuted: '#78614F', border: '#D9DFC5', danger: '#AE3C32',
  disabled: '#969482', overlay: 'rgba(255, 251, 243, 0.96)',
  leaf: '#8CB64A', orange: '#FE7B22', cocoa: '#593D2C',
  // Logo samples with paired accessible foregrounds; sky stays dark for links.
  action: '#8CB64A', onAction: '#382819', actionPressed: '#82AC40',
  leafSurface: '#D9E5B2', surfaceWarm: '#FAE2BF', input: '#FFF9EE',
  orangeSurface: '#FE7B22', orangeSurfaceLight: '#FF9B45',
  destinationTitle: '#123858',
  errorSurface: '#FBECE5', scrim: 'rgba(56, 40, 25, 0.58)',
  // Compatibility aliases let all existing screens share the otter palette.
  midnight: '#FFFBF3', midnightRaised: '#FFFFFF', midnightSoft: '#EDF4DB', white: '#5B402E',
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
  lg: 20,
  pill: 999,
} as const;

export const typography = {
  display: 40,
  title: 28,
  heading: 19,
  body: 15,
  small: 13,
  label: 12,
} as const;
