import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const TOKENS = {
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

const SHARED_COLORS = {
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
  semantic: {
    danger: '#E05252',
    success: '#2DD4A0',
  },
} as const;

const darkTheme = {
  ...TOKENS,
  isDark: true,
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
    brand: SHARED_COLORS.brand,
    accent: SHARED_COLORS.accent,
    text: {
      primary: '#F2F2F5',
      secondary: '#8E8E9A',
      tertiary: '#55555F',
      inverse: '#0D0D0F',
    },
    semantic: SHARED_COLORS.semantic,
    provider: {
      geminiBg: '#1A3A2A',
      ollamaBg: '#1A1A3A',
    },
    shadow: {
      strong: 'rgba(0, 0, 0, 0.35)',
      overlay: 'rgba(0, 0, 0, 0.62)',
    },
  },
} as const;

const lightTheme = {
  ...TOKENS,
  isDark: false,
  colors: {
    bg: {
      base: '#F6F4F1',
      surface: '#FFFFFF',
      elevated: '#F0ECE7',
      overlay: '#E7E0D7',
    },
    border: {
      subtle: '#E4DDD3',
      medium: '#D2C8BC',
      strong: '#B9AB9B',
    },
    brand: {
      primary: SHARED_COLORS.brand.primary,
      soft: '#E8E2FF',
      glow: '#8C7CF2',
    },
    accent: {
      amber: SHARED_COLORS.accent.amber,
      amberSoft: '#FFF4D8',
      teal: SHARED_COLORS.accent.teal,
      tealSoft: '#DFF8F0',
    },
    text: {
      primary: '#171518',
      secondary: '#5F5961',
      tertiary: '#8B8189',
      inverse: '#F6F4F1',
    },
    semantic: SHARED_COLORS.semantic,
    provider: {
      geminiBg: '#DCF4E5',
      ollamaBg: '#E5E2FF',
    },
    shadow: {
      strong: 'rgba(38, 28, 16, 0.12)',
      overlay: 'rgba(22, 18, 13, 0.24)',
    },
  },
} as const;

export const THEMES = {
  dark: darkTheme,
  light: lightTheme,
} as const;

export type ThemeMode = keyof typeof THEMES;
export type AppTheme = (typeof THEMES)[ThemeMode];
export type ThemeColor = AppTheme['colors'];

type ThemeContextValue = {
  mode: ThemeMode;
  theme: AppTheme;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  isReady: boolean;
};

const THEME_STORAGE_KEY = 'ambientmemory-theme-mode';

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'dark',
  theme: THEMES.dark,
  setMode: () => undefined,
  toggleMode: () => undefined,
  isReady: false,
});

export const THEME = THEMES.dark;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function loadThemePreference() {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (stored === 'light' || stored === 'dark') {
          setModeState(stored);
        }
      } finally {
        setIsReady(true);
      }
    }

    loadThemePreference();
  }, []);

  const setMode = (nextMode: ThemeMode) => {
    setModeState(nextMode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode).catch(() => undefined);
  };

  const toggleMode = () => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  };

  const value = useMemo(
    () => ({
      mode,
      theme: THEMES[mode],
      setMode,
      toggleMode,
      isReady,
    }),
    [isReady, mode]
  );

  return React.createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme() {
  return useContext(ThemeContext);
}
