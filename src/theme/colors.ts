// Design system: one neutral scale + one accent hue (indigo), used at
// different depths for "richness" (gradients, ink) instead of adding more
// hues. Both light and dark variants share the same shape so any screen can
// switch via useTheme() without branching logic.
export const lightColors = {
  bg: '#f7f5f2',
  surface: '#ffffff',
  surface2: '#fbfaf8',
  text: '#17151d',
  muted: '#726d78',
  line: '#e9e5ef',
  // Single accent hue — a clean, unambiguous blue (no purple/lavender
  // undertone at any tint). brand2 is a darker shade of the same hue for
  // gradient depth, never an independent color.
  brand: '#2563EB',
  brand2: '#1E3A8A',
  brandSoft: '#000000',
  // Soft accent tint, e.g. the "me" chat bubble — same hue family, light value.
  accentSoft: '#DBEAFE',
  // Functional near-black for buttons like chat "send" — part of the
  // neutral scale, not a separate brand color.
  ink: '#221F2A',
  onInk: '#ffffff',
  green: '#16b87a',
  greenSoft: '#e9fbf4',
  amber: '#e6a019',
  amberSoft: '#fff6df',
  danger: '#ef5a67',
  white: '#ffffff',
};

export const darkColors = {
  bg: '#100e16',
  surface: '#1a1822',
  surface2: '#201d29',
  text: '#f2f0f6',
  muted: '#a39dae',
  line: '#2b2735',
  brand: '#5B9DFF',
  brand2: '#3B82F6',
  brandSoft: '#000000',
  accentSoft: '#1B2C47',
  ink: '#EDEBF2',
  onInk: '#17151d',
  green: '#3ddb98',
  greenSoft: '#123526',
  amber: '#f2b84a',
  amberSoft: '#3a2c0f',
  danger: '#ff7a86',
  white: '#ffffff',
};

export type ThemeColors = typeof lightColors;

// Rich gradient built from the single accent hue at different depths —
// used for both the Home "Your intent" banner and the "Coming up" event
// card, so both read as the same design system rather than two treatments.
export const brandGradient = {
  light: ['#0B1F4D', '#2563EB', '#5B9DFF'],
  dark: ['#061024', '#1D4ED8', '#5B9DFF'],
};

// Static export kept for screens not yet migrated to useTheme() — always
// the light palette. New/updated screens should use useTheme() instead.
export const colors = lightColors;

export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
};
