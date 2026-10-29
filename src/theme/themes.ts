import { lagoonColors, midnightColors, sunriseColors, ThemeColors } from './colors';

export type ThemeName = 'sunrise' | 'lagoon' | 'midnight';

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
  { name: 'lagoon', label: 'Lagoon', blurb: 'Cool mist and teal', scheme: 'light', colors: lagoonColors },
  { name: 'midnight', label: 'Midnight', blurb: 'Dark graphite and gold', scheme: 'dark', colors: midnightColors },
];

export const themeInfo = (name: ThemeName): ThemeInfo => THEMES.find((t) => t.name === name) ?? THEMES[0];

// What was saved on the device. The first version only had a light/dark
// switch, so those two old values map to Sunrise and Midnight.
export function parseStoredTheme(value: unknown): ThemeName | null {
  if (value === 'sunrise' || value === 'lagoon' || value === 'midnight') return value;
  if (value === 'light') return 'sunrise';
  if (value === 'dark') return 'midnight';
  return null;
}
