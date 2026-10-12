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
  // Dark mode isn't covered by the brand spec (which is light/warm only).
  // Graphite: neutral near-black greys with no brown cast, same roles as the
  // light palette. Not a client-approved palette yet.
  bg: '#121314',
  surface: '#1B1C1E',
  surface2: '#242628',
  text: '#F2F3F4',
  muted: '#9DA1A6',
  line: '#2E3033',
  brand: '#F2F3F4',
  onBrand: '#121314',
  brand2: '#4A4D52',
  brandSoft: '#303236',
  accentSoft: '#242628',
  // Light 'send' button on the dark ground, dark arrow on it (the mirror of
  // light mode); ink/onInk were both near-black, so the button disappeared.
  ink: '#F2F3F4',
  onInk: '#121314',
  positive: '#34D399',
  positiveSoft: '#14291E',
  liveFill: '#16A34A',
  amber: '#F2C98A',
  amberSoft: '#33280F',
  amberText: '#F2C98A',
  // A step lighter than the surfaces so the dark card and buttons still read.
  charcoal: '#2E3034',
  champagne: '#D8C8A8',
  selected: '#F2F3F4',
  onSelected: '#121314',
  danger: '#ff7a86',
  white: '#ffffff',
  tint: '#1E1F21',
  tint2: '#26282A',
  tintLine: '#3E4145',
  track: '#3A3D41',
  progressTrack: '#2A2C2F',
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
