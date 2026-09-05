// Sky, boarding-pass paper and sun-yellow details, shared by every trip screen.
export const colors = {
  background: '#EDF6FA', surface: '#FFFFFF', surfaceTint: '#DEEEF3',
  ink: '#15394B', paper: '#FFFFFF',
  coral: '#BC532F', coralPressed: '#A94524', sand: '#FFF2C4',
  sky: '#176B80', gold: '#916412', sun: '#FFD16B',
  textMuted: '#496779', border: '#BCD3DD', danger: '#B43939',
  disabled: '#718894', overlay: 'rgba(237, 246, 250, 0.94)',
  // Compatibility for older native helpers; new UI uses semantic surface names.
  midnight: '#EDF6FA', midnightRaised: '#FFFFFF', midnightSoft: '#DEEEF3', white: '#15394B',
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
