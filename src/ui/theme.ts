export const THEME = {
  colors: {
    bg: {
      base: '#0D0D0F',
      surface: '#141416',
      elevated: '#1C1C1F',
      overlay: '#242428',
    },
    border: {
      subtle: '#232328',
      medium: '#2E2E35',
      strong: '#3A3A45',
    },
    brand: {
      primary: '#6B5CE7',
      soft: '#2D2550',
      glow: '#4D3FB0',
    },
    accent: {
      amber: '#D4A847',
      amberSoft: '#2A2000',
      teal: '#2DD4A0',
      tealSoft: '#0A2520',
    },
    text: {
      primary: '#F2F2F5',
      secondary: '#8E8E9A',
      tertiary: '#55555F',
      inverse: '#0D0D0F',
    },
    semantic: {
      danger: '#E05252',
      success: '#2DD4A0',
    },
    provider: {
      geminiBg: '#1A3A2A',
      ollamaBg: '#1A1A3A',
    },
    shadow: {
      strong: 'rgba(0, 0, 0, 0.35)',
      overlay: 'rgba(0, 0, 0, 0.62)',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 999,
  },
  font: {
    sizes: {
      xs: 10,
      sm: 12,
      md: 14,
      lg: 16,
      xl: 20,
      xxl: 24,
      xxxl: 32,
    },
    weights: {
      regular: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
    },
  },
} as const;

export type ThemeColor = typeof THEME.colors;
