// Design system: warm neutral ground (bone/sand/ink), no blue, no gradients.
// Green is reserved for live/match signals only; amber for outcome states
// only. Everything else (buttons, selected chips, progress, tab icons) uses
// the single ink neutral. Both light and dark variants share the same shape
// so any screen can switch via useTheme() without branching logic.
export const lightColors = {
  bg: '#F4F1EC', // Bone — app ground
  surface: '#FFFDF9', // Card surface
  surface2: '#EDE5D8', // Sand — secondary surface (date blocks, pill base)
  text: '#171310', // Ink
  muted: '#6B6259', // Muted — secondary text, 5.3:1 on bone
  line: '#E6DFD4', // Card border
  // Ink doubles as the one neutral "accent": primary buttons, selected
  // chips, progress fill, tab active tint. Never blue, never a hue.
  brand: '#171310',
  // Text/icons on a brand (primary) button.
  onBrand: '#ffffff',
  // Outline button border (spec: outline buttons use #CFC6B8).
  brand2: '#CFC6B8',
  // Sand strong — selected chips, icon-wrap fills.
  brandSoft: '#E4DACB',
  // Sand — avatar/icon backgrounds, soft pill tint, chat "me" bubble.
  accentSoft: '#EDE5D8',
  // Functional near-black for buttons like chat "send" — same as text/ink.
  ink: '#171310',
  onInk: '#FFFDF9',
  // Green TEXT — match scores and counts. Never used as a fill/icon color.
  positive: '#147A3A',
  // Green tint — background behind green text (e.g. a match-count pill).
  positiveSoft: '#E7F3EA',
  // Green FILL — live dot, live ring (PulseRings), live button. Never text.
  liveFill: '#16A34A',
  // Amber — outcome states only (e.g. "Confirm you met").
  amber: '#F2A93B',
  amberSoft: '#FBEBD0',
  amberText: '#7A4E0F',
  // The one large dark element (default Go Live button).
  charcoal: '#3A3531',
  danger: '#ef5a67',
  white: '#ffffff',
  // Warm concentric halo behind the Go Live ring, lightest to deepest.
  tint: '#F1EBE0',
  tint2: '#E7DCC9',
  tintLine: '#CFC6B8',
  track: '#D9D3C8',
  progressTrack: '#EFEAE0',
};

export const darkColors = {
  // Dark mode isn't covered by the brand spec (which is light/warm only) —
  // this is a reasonable warm-neutral inversion of the same roles, not a
  // client-approved palette. Revisit if/when the client defines one.
  bg: '#17120C',
  surface: '#211A12',
  surface2: '#2A2217',
  text: '#F4F1EC',
  muted: '#A89C8C',
  line: '#3A3025',
  brand: '#F4F1EC',
  onBrand: '#171310',
  brand2: '#55493A',
  brandSoft: '#3A3024',
  accentSoft: '#2A2217',
  // Light 'send' button on the dark ground, dark arrow on it (the mirror of
  // light mode); ink/onInk were both near-black, so the button disappeared.
  ink: '#F4F1EC',
  onInk: '#171310',
  positive: '#34D399',
  positiveSoft: '#15301F',
  liveFill: '#16A34A',
  amber: '#F2C98A',
  amberSoft: '#3A2A10',
  amberText: '#F2C98A',
  charcoal: '#3A3531',
  danger: '#ff7a86',
  white: '#ffffff',
  tint: '#241D14',
  tint2: '#2E2518',
  tintLine: '#4A3F30',
  track: '#473C2D',
  progressTrack: '#2b2735',
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
