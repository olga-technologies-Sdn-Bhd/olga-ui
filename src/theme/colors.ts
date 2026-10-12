// Design system: a quiet neutral ground (off-white, white) with midnight navy
// as the one deep colour, no gradients. Green is reserved for live/match signals only; a muted gold
// for outcome states only. Everything else (buttons, selected chips,
// progress, tab icons) uses the single ink neutral. Both light and dark
// variants share the same shape so any screen can switch via useTheme()
// without branching logic.
export const lightColors = {
  bg: '#F6F6F4', // App ground
  surface: '#FFFFFF', // Card surface
  surface2: '#EEEEEB', // Secondary surface (date blocks, inputs, pill base)
  text: '#141B26', // Ink, with a navy cast
  muted: '#646B76', // Secondary text
  line: '#E4E4E1', // Hairlines and card borders
  // Midnight navy is the one "accent": primary buttons, selected
  // chips, progress fill, tab active tint. Low saturation, never bright.
  brand: '#1B2A41',
  // Text/icons on a brand (primary) button.
  onBrand: '#ffffff',
  // Outline button border.
  brand2: '#CFCFCB',
  // Selected chips, icon-wrap fills.
  brandSoft: '#E4E4E0',
  // Avatar/icon backgrounds, soft pill tint, chat "me" bubble.
  accentSoft: '#EEEEEB',
  // Buttons like chat "send": the same navy as brand.
  ink: '#1B2A41',
  onInk: '#FFFFFF',
  // Green TEXT: match scores and counts. Never used as a fill/icon color.
  positive: '#147A3A',
  // Green tint: background behind green text (e.g. a match-count pill).
  positiveSoft: '#E7F3EB',
  // Green FILL: live dot, live ring (PulseRings), live button. Never text.
  liveFill: '#16A34A',
  // Muted gold: outcome states only (e.g. "Confirm you met").
  amber: '#B8975A',
  amberSoft: '#F3ECDD',
  amberText: '#6B5220',
  // The one large dark element (Social Capital card, default Go Live
  // button): midnight navy, which reads as trust and calm where black
  // read as heavy.
  charcoal: '#1B2A41',
  // Champagne: the small title on the navy card.
  champagne: '#D8C8A8',
  // Selected chip / active tab underline, and the text on it.
  selected: '#1B2A41',
  onSelected: '#ffffff',
  danger: '#D64555',
  white: '#ffffff',
  // Concentric halo behind the Go Live ring, lightest to deepest.
  tint: '#EFEFEC',
  tint2: '#E4E4E0',
  tintLine: '#CFCFCB',
  track: '#D6D6D2',
  progressTrack: '#ECECE9',
};

export const darkColors = {
  // Midnight: the same navy family as light mode, taken deep. Same roles as
  // the light palette. Not a client-approved palette yet.
  bg: '#0E1522',
  surface: '#151E2E',
  surface2: '#1C2738',
  text: '#F1F3F6',
  muted: '#9AA4B2',
  line: '#263247',
  brand: '#F1F3F6',
  onBrand: '#0E1522',
  brand2: '#3D4B63',
  brandSoft: '#27344A',
  accentSoft: '#1C2738',
  // Light 'send' button on the dark ground, dark arrow on it (the mirror of
  // light mode).
  ink: '#F1F3F6',
  onInk: '#0E1522',
  positive: '#34D399',
  positiveSoft: '#12302A',
  liveFill: '#16A34A',
  amber: '#D8C8A8',
  amberSoft: '#2B2A26',
  amberText: '#D8C8A8',
  // A step lighter than the surfaces so the dark card and buttons still read.
  charcoal: '#24334D',
  champagne: '#D8C8A8',
  selected: '#F1F3F6',
  onSelected: '#0E1522',
  danger: '#ff7a86',
  white: '#ffffff',
  tint: '#131C2B',
  tint2: '#1A2537',
  tintLine: '#33415A',
  track: '#2F3C54',
  progressTrack: '#1F2A3D',
};

export type ThemeColors = typeof lightColors;

// Static export kept for screens not yet migrated to useTheme() — always
// the light palette. New/updated screens should use useTheme() instead.
export const colors = lightColors;

export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
};
