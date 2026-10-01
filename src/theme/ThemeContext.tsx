import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as Keychain from 'react-native-keychain';
import { darkColors, lightColors, ThemeColors } from './colors';

export type Scheme = 'light' | 'dark';

type ThemeContextValue = {
  colors: ThemeColors;
  scheme: Scheme;
  setScheme: (scheme: Scheme) => void;
};

// Light is the app default — the brand spec is a light/warm palette only.
// The user's choice (Profile → Appearance) is kept on device. Stored via
// react-native-keychain only because it's the one storage module already
// installed — the value itself isn't sensitive.
const DEFAULT_SCHEME: Scheme = 'light';
const STORAGE_SERVICE = 'olga.theme';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [scheme, setSchemeState] = useState<Scheme>(DEFAULT_SCHEME);

  useEffect(() => {
    Keychain.getGenericPassword({ service: STORAGE_SERVICE })
      .then((stored) => {
        if (stored && (stored.password === 'light' || stored.password === 'dark')) {
          setSchemeState(stored.password);
        }
      })
      .catch(() => {});
  }, []);

  const setScheme = useCallback((next: Scheme) => {
    setSchemeState(next);
    Keychain.setGenericPassword(STORAGE_SERVICE, next, { service: STORAGE_SERVICE }).catch(() => {});
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: scheme === 'dark' ? darkColors : lightColors,
      scheme,
      setScheme,
    }),
    [scheme, setScheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
