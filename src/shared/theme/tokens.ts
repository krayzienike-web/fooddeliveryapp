/**
 * Design tokens. Source of truth: docs/ux-ui-guidebook.md §2.
 * Idea: «угли в темноте» — warm near-black, one hot accent («Жар»), gold only for loyalty.
 */

export interface Palette {
  bg: string;
  surface: string;
  surfaceRaised: string;
  surfaceHigh: string;
  outline: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  onAccent: string;
  accentTonal: string;
  accentBright: string;
  gold: string;
  goldTonal: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  scrim: string;
  overlay: string;
  map: { land: string; water: string; park: string; road: string; roadMajor: string; building: string; label: string };
}

export const dark: Palette = {
  bg: '#120D0B',
  surface: '#1C1512',
  surfaceRaised: '#261C18',
  surfaceHigh: '#33261F',
  outline: '#3D2F28',
  textPrimary: '#F7EFE8',
  textSecondary: '#C9B8AC',
  textTertiary: '#9C8B80',
  accent: '#FF5A1F',
  onAccent: '#1A0A03',
  accentTonal: 'rgba(255,90,31,0.16)',
  accentBright: '#FF5A1F',
  gold: '#FFB547',
  goldTonal: 'rgba(255,181,71,0.16)',
  success: '#3FCF8E',
  warning: '#FFC24B',
  error: '#FF6B6B',
  info: '#7FB2FF',
  scrim: 'rgba(18,13,11,0.72)',
  overlay: 'rgba(0,0,0,0.55)',
  map: { land: '#17110E', water: '#0B1418', park: '#141A12', road: '#2A201B', roadMajor: '#3A2C24', building: '#1E1714', label: '#9C8B80' },
};

export const light: Palette = {
  bg: '#FFF8F3',
  surface: '#FFFFFF',
  surfaceRaised: '#FFF1E8',
  surfaceHigh: '#F6E4D8',
  outline: '#EAD7CB',
  textPrimary: '#1E1410',
  textSecondary: '#5C4A40',
  textTertiary: '#80695D',
  accent: '#C23A0A',
  onAccent: '#FFFFFF',
  accentTonal: 'rgba(194,58,10,0.10)',
  accentBright: '#FF5A1F',
  gold: '#B87200',
  goldTonal: 'rgba(255,181,71,0.22)',
  success: '#1A7A50',
  warning: '#9A6400',
  error: '#C8372D',
  info: '#2D62B8',
  scrim: 'rgba(18,13,11,0.62)',
  overlay: 'rgba(0,0,0,0.4)',
  map: { land: '#F4EBE3', water: '#CFE0E6', park: '#DCE7D2', road: '#FFFFFF', roadMajor: '#FBE3D2', building: '#EADDD2', label: '#80695D' },
};

export const space = { xxs: 2, xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, x3: 32, x4: 40, x5: 48, x6: 64 } as const;

export const radius = { xs: 8, s: 12, m: 16, l: 24, full: 999 } as const;

export const fonts = {
  display600: 'Unbounded_600SemiBold',
  display700: 'Unbounded_700Bold',
  display800: 'Unbounded_800ExtraBold',
  text400: 'Onest_400Regular',
  text500: 'Onest_500Medium',
  text600: 'Onest_600SemiBold',
  text700: 'Onest_700Bold',
} as const;

export type TypeToken =
  | 'displayL'
  | 'displayM'
  | 'headline'
  | 'titleL'
  | 'titleM'
  | 'bodyL'
  | 'bodyM'
  | 'label'
  | 'caption'
  | 'priceL'
  | 'priceM';

export const type: Record<TypeToken, { fontFamily: string; fontSize: number; lineHeight: number; letterSpacing?: number }> = {
  displayL: { fontFamily: fonts.display700, fontSize: 32, lineHeight: 38, letterSpacing: -0.5 },
  displayM: { fontFamily: fonts.display700, fontSize: 26, lineHeight: 32, letterSpacing: -0.3 },
  headline: { fontFamily: fonts.display600, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  titleL: { fontFamily: fonts.text600, fontSize: 18, lineHeight: 24 },
  titleM: { fontFamily: fonts.text600, fontSize: 16, lineHeight: 22 },
  bodyL: { fontFamily: fonts.text400, fontSize: 16, lineHeight: 24 },
  bodyM: { fontFamily: fonts.text400, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: fonts.text500, fontSize: 13, lineHeight: 16, letterSpacing: 0.1 },
  caption: { fontFamily: fonts.text400, fontSize: 12, lineHeight: 16 },
  priceL: { fontFamily: fonts.text700, fontSize: 20, lineHeight: 24 },
  priceM: { fontFamily: fonts.text600, fontSize: 16, lineHeight: 20 },
};

/** Motion tokens (guidebook §2.6). Springs in Reanimated terms. */
export const motion = {
  springCalm: { stiffness: 380, damping: 39, mass: 1 },
  springStandard: { stiffness: 380, damping: 33, mass: 1 },
  springExpressive: { stiffness: 500, damping: 27, mass: 1 },
  springSlow: { stiffness: 200, damping: 25, mass: 1 },
  durFast: 120,
  durMedium: 220,
  durLong: 350,
  durCelebrate: 1200,
  stagger: 30,
} as const;

export const elevation = {
  sheet: { shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  float: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
} as const;
