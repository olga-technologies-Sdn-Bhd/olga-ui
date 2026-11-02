import { harborColors, midnightColors, sunriseColors, ThemeColors } from './colors';

export type ThemeName = 'sunrise' | 'harbor' | 'midnight';

// Whether a look is light or dark: decides the status bar, the navigator's
// base theme and the Google/Apple sign-in button style.
export type Scheme = 'light' | 'dark';

export type ThemeInfo = {
  name: ThemeName;
  label: string;
  blurb: string;
  scheme: Scheme;
  colors: ThemeColors;
};

// Light is the app default: Sunrise is the original look.
export const DEFAULT_THEME: ThemeName = 'sunrise';

export const THEMES: ThemeInfo[] = [
  { name: 'sunrise', label: 'Sunrise', blurb: 'Warm ivory and coral', scheme: 'light', colors: sunriseColors },
  { name: 'harbor', label: 'Harbor', blurb: 'Cool white and navy', scheme: 'light', colors: harborColors },
  { name: 'midnight', label: 'Midnight', blurb: 'Deep navy and gold', scheme: 'dark', colors: midnightColors },
];

export const themeInfo = (name: ThemeName): ThemeInfo => THEMES.find((t) => t.name === name) ?? THEMES[0];

// What was saved on the device. The first version only had a light/dark
// switch, so those two old values map to Sunrise and Midnight. Lagoon (a
// teal look that Harbor replaced) maps to Harbor.
export function parseStoredTheme(value: unknown): ThemeName | null {
  if (value === 'sunrise' || value === 'harbor' || value === 'midnight') return value;
  if (value === 'lagoon') return 'harbor';
  if (value === 'light') return 'sunrise';
  if (value === 'dark') return 'midnight';
  return null;
}
