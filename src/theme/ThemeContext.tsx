import { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { brandGradient, darkColors, lightColors, ThemeColors } from './colors';

type Scheme = 'light' | 'dark';

type ThemeContextValue = {
  colors: ThemeColors;
  scheme: Scheme;
  gradient: string[];
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const scheme: Scheme = systemScheme === 'dark' ? 'dark' : 'light';

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: scheme === 'dark' ? darkColors : lightColors,
      scheme,
      gradient: scheme === 'dark' ? brandGradient.dark : brandGradient.light,
    }),
    [scheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
