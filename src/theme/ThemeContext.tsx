import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as Keychain from 'react-native-keychain';
import { ThemeColors } from './colors';
import { DEFAULT_THEME, parseStoredTheme, Scheme, themeInfo, ThemeName } from './themes';

export type { Scheme, ThemeName } from './themes';

type ThemeContextValue = {
  colors: ThemeColors;
  // Whether the chosen look is light or dark.
  scheme: Scheme;
  // The chosen look: Sunrise, Harbor or Midnight.
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
};

// Sunrise is the app default. The member's choice (Profile → Appearance) is
// kept on device. Stored via react-native-keychain only because it's the one
// storage module already installed — the value itself isn't sensitive.
const STORAGE_SERVICE = 'olga.theme';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(DEFAULT_THEME);

  useEffect(() => {
    Keychain.getGenericPassword({ service: STORAGE_SERVICE })
      .then((stored) => {
        const saved = stored ? parseStoredTheme(stored.password) : null;
        if (saved) setThemeState(saved);
      })
      .catch(() => {});
  }, []);

  const setTheme = useCallback((next: ThemeName) => {
    setThemeState(next);
    Keychain.setGenericPassword(STORAGE_SERVICE, next, { service: STORAGE_SERVICE }).catch(() => {});
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const info = themeInfo(theme);
    return { colors: info.colors, scheme: info.scheme, theme, setTheme };
  }, [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
